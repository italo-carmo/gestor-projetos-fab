import { Injectable } from '@nestjs/common';
import { Prisma, TaskPriority, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { throwError } from '../common/http-error';
import { AuditService } from '../audit/audit.service';
import { RbacUser } from '../rbac/rbac.types';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listPhases() {
    return this.prisma.phase.findMany({ orderBy: { order: 'asc' } });
  }

  listTaskTemplates() {
    return this.prisma.taskTemplate.findMany({ orderBy: { title: 'asc' } });
  }

  createTaskTemplate(data: Prisma.TaskTemplateCreateInput, user?: RbacUser) {
    return this.prisma.taskTemplate.create({ data }).then(async (created) => {
      await this.audit.log({
        userId: user?.id,
        resource: 'task_templates',
        action: 'create',
        entityId: created.id,
        localityId: user?.localityId ?? undefined,
      });
      return created;
    });
  }

  async generateInstances(templateId: string, payload: {
    localities: { localityId: string; dueDate: string }[];
    reportRequired?: boolean;
    priority?: TaskPriority | string;
    meetingId?: string | null;
    assignedToId?: string | null;
  }, user?: RbacUser) {
    const template = await this.prisma.taskTemplate.findUnique({ where: { id: templateId } });
    if (!template) throwError('NOT_FOUND');

    const reportRequired = payload.reportRequired ?? template.reportRequiredDefault;
    const priority = (payload.priority as TaskPriority) ?? TaskPriority.MEDIUM;

    const created = await this.prisma.$transaction(
      payload.localities.map((entry) =>
        this.prisma.taskInstance.create({
          data: {
            taskTemplateId: templateId,
            localityId: entry.localityId,
            dueDate: new Date(entry.dueDate),
            status: TaskStatus.NOT_STARTED,
            priority,
            progressPercent: 0,
            assignedToId: payload.assignedToId ?? null,
            reportRequired,
            meetingId: payload.meetingId ?? null,
          },
        }),
      ),
    );

    await this.audit.log({
      userId: user?.id,
      resource: 'task_instances',
      action: 'create_batch',
      localityId: user?.localityId ?? undefined,
      diffJson: { templateId, count: created.length },
    });

    return { items: created };
  }

  async listTaskInstances(filters: {
    localityId?: string;
    phaseId?: string;
    status?: string;
    assigneeId?: string;
    dueFrom?: string;
    dueTo?: string;
    page?: string;
    pageSize?: string;
  }, user?: RbacUser) {
    const { where, taskTemplateFilter } = this.buildTaskWhere(filters, user);
    if (Object.keys(taskTemplateFilter).length > 0) {
      where.taskTemplate = taskTemplateFilter;
    }

    const { page, pageSize, skip, take } = this.parsePagination(filters.page, filters.pageSize);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.taskInstance.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        skip,
        take,
      }),
      this.prisma.taskInstance.count({ where }),
    ]);

    return {
      items: items.map((item) => this.mapTaskInstance(item, user?.executiveHidePii)),
      page,
      pageSize,
      total,
    };
  }

  async updateStatus(id: string, status: TaskStatus, user?: RbacUser) {
    const instance = await this.prisma.taskInstance.findUnique({
      where: { id },
      include: { reports: true, taskTemplate: { select: { specialtyId: true } } },
    });
    if (!instance) throwError('NOT_FOUND');

    this.assertConstraints(instance.localityId, instance.taskTemplate?.specialtyId ?? null, user);

    if (status === TaskStatus.DONE && instance.reportRequired && instance.reports.length === 0) {
      throwError('REPORT_REQUIRED');
    }

    if (status === TaskStatus.IN_PROGRESS) {
      const blocked = await this.hasBlockingDependencies(
        instance.blockedByIdsJson as string[] | null | undefined,
      );
      if (blocked) {
        throwError('TASK_BLOCKED');
      }
    }

    const progressPercent = this.applyProgressRules(status, instance.progressPercent);

    const updated = await this.prisma.taskInstance.update({
      where: { id },
      data: { status, progressPercent },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'task_instances',
      action: 'update_status',
      entityId: id,
      localityId: instance.localityId,
      diffJson: { status },
    });

    return this.mapTaskInstance(updated, user?.executiveHidePii);
  }

  async updateProgress(id: string, progressPercent: number, user?: RbacUser) {
    const instance = await this.prisma.taskInstance.findUnique({
      where: { id },
      include: { taskTemplate: { select: { specialtyId: true } } },
    });
    if (!instance) throwError('NOT_FOUND');

    this.assertConstraints(instance.localityId, instance.taskTemplate?.specialtyId ?? null, user);

    const adjusted = this.applyProgressRules(instance.status, progressPercent);

    const updated = await this.prisma.taskInstance.update({
      where: { id },
      data: { progressPercent: adjusted },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'task_instances',
      action: 'update_progress',
      entityId: id,
      localityId: instance.localityId,
      diffJson: { progressPercent: adjusted },
    });

    return this.mapTaskInstance(updated, user?.executiveHidePii);
  }

  async assignTask(id: string, assignedToId: string | null, user?: RbacUser) {
    const instance = await this.prisma.taskInstance.findUnique({
      where: { id },
      include: { taskTemplate: { select: { specialtyId: true } } },
    });
    if (!instance) throwError('NOT_FOUND');

    this.assertConstraints(instance.localityId, instance.taskTemplate?.specialtyId ?? null, user);

    const updated = await this.prisma.taskInstance.update({
      where: { id },
      data: { assignedToId },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'task_instances',
      action: 'assign',
      entityId: id,
      localityId: instance.localityId,
      diffJson: { assignedToId },
    });

    return this.mapTaskInstance(updated, user?.executiveHidePii);
  }

  async getGantt(params: { localityId?: string; from?: string; to?: string }, user?: RbacUser) {
    const where: Prisma.TaskInstanceWhereInput = {};
    if (params.localityId) where.localityId = params.localityId;
    if (params.from || params.to) {
      where.dueDate = {};
      if (params.from) where.dueDate.gte = new Date(params.from);
      if (params.to) where.dueDate.lte = new Date(params.to);
    }

    const constraints = this.getScopeConstraints(user);
    if (constraints.localityId) {
      where.localityId = constraints.localityId;
    }
    if (constraints.specialtyId) {
      where.taskTemplate = { specialtyId: constraints.specialtyId };
    }

    const items = await this.prisma.taskInstance.findMany({ where });
    return { items: items.map((item) => this.mapTaskInstance(item, user?.executiveHidePii)) };
  }

  async getCalendar(year: number, user?: RbacUser) {
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));

    const where: Prisma.TaskInstanceWhereInput = {
      dueDate: { gte: start, lt: end },
    };

    const constraints = this.getScopeConstraints(user);
    if (constraints.localityId) {
      where.localityId = constraints.localityId;
    }
    if (constraints.specialtyId) {
      where.taskTemplate = { specialtyId: constraints.specialtyId };
    }

    const items = await this.prisma.taskInstance.findMany({
      where,
      include: { taskTemplate: { include: { phase: true } } },
    });

    return {
      items: items.map((item) => ({
        taskInstanceId: item.id,
        date: item.dueDate,
        title: `[${item.taskTemplate.phase.name}] ${item.taskTemplate.title}`,
      })),
    };
  }

  async getLocalityProgress(localityId: string, user?: RbacUser) {
    this.assertConstraints(localityId, null, user);

    const taskWhere: Prisma.TaskInstanceWhereInput = { localityId };
    const constraints = this.getScopeConstraints(user);
    if (constraints.specialtyId) {
      taskWhere.taskTemplate = { specialtyId: constraints.specialtyId };
    }

    const tasks = await this.prisma.taskInstance.findMany({
      where: taskWhere,
      include: { taskTemplate: { include: { phase: true } } },
    });

    const byPhase = new Map<string, { total: number; count: number }>();
    for (const task of tasks) {
      const phaseName = task.taskTemplate.phase.name;
      const entry = byPhase.get(phaseName) ?? { total: 0, count: 0 };
      entry.total += task.progressPercent;
      entry.count += 1;
      byPhase.set(phaseName, entry);
    }

    const phaseEntries = Array.from(byPhase.entries()).map(([phaseName, stats]) => ({
      phaseName,
      progress: stats.count === 0 ? 0 : stats.total / stats.count,
    }));

    const overallProgress =
      phaseEntries.length === 0
        ? 0
        : phaseEntries.reduce((acc, entry) => acc + entry.progress, 0) / phaseEntries.length;

    return {
      localityId,
      overallProgress,
      byPhase: phaseEntries,
    };
  }

  async getDashboardNational(user?: RbacUser) {
    const where: Prisma.LocalityWhereInput = {};
    const constraints = this.getScopeConstraints(user);
    if (constraints.localityId) {
      where.id = constraints.localityId;
    }

    const localities = await this.prisma.locality.findMany({ where });
    const taskWhere: Prisma.TaskInstanceWhereInput = {};
    if (constraints.specialtyId) {
      taskWhere.taskTemplate = { specialtyId: constraints.specialtyId };
    }

    const tasks = await this.prisma.taskInstance.findMany({
      where: taskWhere,
      include: { locality: true, taskTemplate: true },
    });
    const statusById = new Map(tasks.map((task) => [task.id, task.status]));

    const perLocality = localities.map((locality) => {
      const localityTasks = tasks.filter((task) => task.localityId === locality.id);
      const late = localityTasks.filter((task) => this.isLate(task)).length;
      const blocked = localityTasks.filter((task) =>
        this.isBlocked(task.blockedByIdsJson as string[] | null | undefined, statusById),
      ).length;
      const unassigned = localityTasks.filter((task) => !task.assignedToId).length;
      const progress = localityTasks.length
        ? localityTasks.reduce((acc, task) => acc + task.progressPercent, 0) / localityTasks.length
        : 0;

      return {
        localityId: locality.id,
        localityName: locality.name,
        progress,
        late,
        blocked,
        unassigned,
      };
    });

    return {
      items: perLocality,
      totals: {
        localities: perLocality.length,
        late: perLocality.reduce((acc, item) => acc + item.late, 0),
        blocked: perLocality.reduce((acc, item) => acc + item.blocked, 0),
        unassigned: perLocality.reduce((acc, item) => acc + item.unassigned, 0),
      },
      executive_hide_pii: user?.executiveHidePii ?? false,
    };
  }

  private applyProgressRules(status: TaskStatus, progressPercent: number) {
    if (status === TaskStatus.NOT_STARTED) return 0;
    if (status === TaskStatus.DONE) return 100;
    if (progressPercent >= 100) return 99;
    if (progressPercent < 0) return 0;
    return progressPercent;
  }

  private isLate(instance: { dueDate: Date; status: TaskStatus }) {
    return instance.status !== TaskStatus.DONE && instance.dueDate.getTime() < Date.now();
  }

  private isBlocked(blockedByIds?: string[] | null, statusById?: Map<string, TaskStatus>) {
    if (!Array.isArray(blockedByIds) || blockedByIds.length === 0) return false;
    if (!statusById) return true;
    return blockedByIds.some((id) => statusById.get(id) !== TaskStatus.DONE);
  }

  private mapTaskInstance(instance: any, executiveHidePii?: boolean) {
    const mapped = {
      ...instance,
      isLate: this.isLate(instance),
      blockedByIds: (instance.blockedByIdsJson as string[] | null) ?? null,
    } as any;

    delete mapped.blockedByIdsJson;

    if (executiveHidePii) {
      delete mapped.assignedTo;
    }

    return mapped;
  }

  private getScopeConstraints(user?: RbacUser) {
    if (!user) return {};
    return {
      localityId: user.localityId ?? undefined,
      specialtyId: user.specialtyId ?? undefined,
    };
  }

  private assertConstraints(localityId: string, specialtyId: string | null, user?: RbacUser) {
    const constraints = this.getScopeConstraints(user);
    if (constraints.localityId && constraints.localityId !== localityId) {
      throwError('RBAC_FORBIDDEN');
    }
    if (constraints.specialtyId && constraints.specialtyId !== specialtyId) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private async hasBlockingDependencies(blockedByIds?: string[] | null) {
    if (!Array.isArray(blockedByIds) || blockedByIds.length === 0) return false;
    const blockers = await this.prisma.taskInstance.findMany({
      where: { id: { in: blockedByIds } },
      select: { status: true },
    });
    return blockers.some((blocker) => blocker.status !== TaskStatus.DONE);
  }

  private buildTaskWhere(filters: {
    localityId?: string;
    phaseId?: string;
    status?: string;
    assigneeId?: string;
    dueFrom?: string;
    dueTo?: string;
  }, user?: RbacUser) {
    const where: Prisma.TaskInstanceWhereInput = {};

    if (filters.localityId) where.localityId = filters.localityId;
    if (filters.status) where.status = filters.status as TaskStatus;
    if (filters.assigneeId) where.assignedToId = filters.assigneeId;
    if (filters.dueFrom || filters.dueTo) {
      where.dueDate = {};
      if (filters.dueFrom) where.dueDate.gte = new Date(filters.dueFrom);
      if (filters.dueTo) where.dueDate.lte = new Date(filters.dueTo);
    }

    const taskTemplateFilter: Prisma.TaskTemplateWhereInput = {};
    if (filters.phaseId) {
      taskTemplateFilter.phaseId = filters.phaseId;
    }

    const constraints = this.getScopeConstraints(user);
    if (constraints.localityId) {
      where.localityId = constraints.localityId;
    }
    if (constraints.specialtyId) {
      taskTemplateFilter.specialtyId = constraints.specialtyId;
    }

    return { where, taskTemplateFilter };
  }

  async listTaskInstancesForExport(filters: {
    localityId?: string;
    phaseId?: string;
    status?: string;
    assigneeId?: string;
    dueFrom?: string;
    dueTo?: string;
  }, user?: RbacUser) {
    const { where, taskTemplateFilter } = this.buildTaskWhere(filters, user);
    if (Object.keys(taskTemplateFilter).length > 0) {
      where.taskTemplate = taskTemplateFilter;
    }

    const items = await this.prisma.taskInstance.findMany({
      where,
      include: { taskTemplate: { include: { phase: true, specialty: true } }, locality: true },
      orderBy: { dueDate: 'asc' },
    });

    return items.map((item) => this.mapTaskInstance(item, user?.executiveHidePii));
  }

  private parsePagination(pageRaw?: string, pageSizeRaw?: string) {
    const page = Math.max(1, Number(pageRaw ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(10, Number(pageSizeRaw ?? 20) || 20));
    const skip = (page - 1) * pageSize;
    return { page, pageSize, skip, take: pageSize };
  }
}
