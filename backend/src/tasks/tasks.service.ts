import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ActivityScope,
  ActivityStatus,
  LocalityCatalogType,
  PermissionScope,
  Prisma,
  TaskAssigneeType,
  TaskPriority,
  TaskStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { throwError } from '../common/http-error';
import { AuditService } from '../audit/audit.service';
import { RbacUser } from '../rbac/rbac.types';
import { hasPermission, resolveAccessProfile } from '../rbac/role-access';
import { sanitizeForExecutive } from '../common/executive';
import { sanitizeText } from '../common/sanitize';
import {
  createTargetLocalityAliasMap,
  groupTargetLocalities,
  selectTargetLocalities,
} from '../common/priority-localities';

type DashboardNationalCardSettingDefault = {
  id: string;
  title: string;
  description: string;
  backgroundColor: string;
  textColor: string;
};

const DASHBOARD_NATIONAL_CARD_SETTING_DEFAULTS: DashboardNationalCardSettingDefault[] =
  [
    {
      id: 'smif-completed',
      title: 'Entregas Realizadas',
      description: 'Resumo de atuação da CIPAVD.',
      backgroundColor: '#1F4A61',
      textColor: '#F4FAFD',
    },
    {
      id: 'smif-field',
      title: 'Atividades de campo realizadas pela CIPAVD.',
      description: 'Apoio realizado pela área técnica dos integrantes.',
      backgroundColor: '#2F6F8A',
      textColor: '#F2FBFE',
    },
    {
      id: 'smif-participants',
      title: 'Público alcançado',
      description: 'Total de participações em atividades de campo.',
      backgroundColor: '#3A7A9A',
      textColor: '#F0F9FC',
    },
  ];

const DASHBOARD_NATIONAL_CARD_SETTING_ID_SET = new Set(
  DASHBOARD_NATIONAL_CARD_SETTING_DEFAULTS.map((item) => item.id),
);

@Injectable()
export class TasksService {
  private readonly manualTaskTemplateTitle = 'Tarefa manual';
  private readonly manualTaskTemplateDescription =
    'Template técnico para tarefas criadas manualmente no módulo.';
  private readonly phaseLabelByCode: Record<string, string> = {
    PREPARACAO: 'Preparação',
    EXECUCAO: 'Execução',
    ACOMPANHAMENTO: 'Acompanhamento',
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listPhases() {
    const phases = await this.prisma.phase.findMany({
      orderBy: { order: 'asc' },
    });
    return phases.map((phase) => this.mapPhase(phase));
  }

  async updatePhase(
    id: string,
    payload: { displayName?: string | null },
    user?: RbacUser,
  ) {
    const existing = await this.prisma.phase.findUnique({ where: { id } });
    if (!existing) throwError('NOT_FOUND');

    const normalized =
      payload.displayName === undefined
        ? existing.displayName
        : payload.displayName && payload.displayName.trim()
          ? sanitizeText(payload.displayName.trim())
          : null;

    const updated = await this.prisma.phase.update({
      where: { id },
      data: { displayName: normalized },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'phases',
      action: 'update',
      entityId: id,
      diffJson: { displayName: updated.displayName ?? null },
    });

    return this.mapPhase(updated);
  }

  listTaskTemplates() {
    return this.prisma.taskTemplate.findMany({
      where: { deletedAt: null },
      orderBy: { title: 'asc' },
      include: { eloRole: { select: { id: true, code: true, name: true } } },
    });
  }

  async createTaskTemplate(
    data: Prisma.TaskTemplateCreateInput,
    user?: RbacUser,
  ) {
    const payload = data as any;
    const phaseId = payload.phase?.connect?.id as string | undefined;
    const specialtyId = payload.specialty?.connect?.id as
      | string
      | null
      | undefined;
    const eloRoleId = payload.eloRole?.connect?.id as string | null | undefined;
    const title = String(payload.title ?? '').trim();

    if (phaseId && title) {
      const existing = await this.prisma.taskTemplate.findFirst({
        where: {
          deletedAt: null,
          title: { equals: title, mode: 'insensitive' },
          phaseId,
          specialtyId: specialtyId ?? null,
          eloRoleId: eloRoleId ?? null,
        },
        select: { id: true },
      });
      if (existing) {
        throwError('CONFLICT_UNIQUE', {
          resource: 'task_templates',
          field: 'title+phaseId+specialtyId+eloRoleId',
          existingId: existing.id,
        });
      }
    }

    const created = await this.prisma.taskTemplate.create({ data });
    await this.audit.log({
      userId: user?.id,
      resource: 'task_templates',
      action: 'create',
      entityId: created.id,
      localityId: user?.localityId ?? undefined,
    });
    return created;
  }

  async updateTaskTemplate(
    id: string,
    payload: {
      title?: string;
      description?: string | null;
      phaseId?: string;
      specialtyId?: string | null;
      eloRoleId?: string | null;
      appliesToAllLocalities?: boolean;
      reportRequiredDefault?: boolean;
    },
    user?: RbacUser,
  ) {
    this.assertTemplateManageAccess(user);

    const existing = await this.prisma.taskTemplate.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        title: true,
        description: true,
        phaseId: true,
        specialtyId: true,
        eloRoleId: true,
        appliesToAllLocalities: true,
        reportRequiredDefault: true,
      },
    });
    if (!existing) throwError('NOT_FOUND');

    const normalizedTitle =
      payload.title === undefined
        ? existing.title
        : sanitizeText(payload.title);
    if (!normalizedTitle) {
      throwError('VALIDATION_ERROR', { field: 'title', reason: 'required' });
    }

    const normalizedDescription =
      payload.description === undefined
        ? existing.description
        : payload.description === null
          ? null
          : sanitizeText(payload.description);
    const phaseId = payload.phaseId ?? existing.phaseId;
    const specialtyId =
      payload.specialtyId === undefined
        ? existing.specialtyId
        : payload.specialtyId;
    const eloRoleId =
      payload.eloRoleId === undefined ? existing.eloRoleId : payload.eloRoleId;
    const appliesToAllLocalities =
      payload.appliesToAllLocalities ?? existing.appliesToAllLocalities;
    const reportRequiredDefault =
      payload.reportRequiredDefault ?? existing.reportRequiredDefault;

    const duplicate = await this.prisma.taskTemplate.findFirst({
      where: {
        deletedAt: null,
        id: { not: id },
        title: { equals: normalizedTitle, mode: 'insensitive' },
        phaseId,
        specialtyId,
        eloRoleId,
      },
      select: { id: true },
    });
    if (duplicate) {
      throwError('CONFLICT_UNIQUE', {
        resource: 'task_templates',
        field: 'title+phaseId+specialtyId+eloRoleId',
        existingId: duplicate.id,
      });
    }

    const updated = await this.prisma.taskTemplate.update({
      where: { id },
      data: {
        title: normalizedTitle,
        description: normalizedDescription,
        phaseId,
        specialtyId,
        eloRoleId,
        appliesToAllLocalities,
        reportRequiredDefault,
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'task_templates',
      action: 'update',
      entityId: updated.id,
      localityId: user?.localityId ?? undefined,
      diffJson: {
        title: updated.title,
        phaseId: updated.phaseId,
        specialtyId: updated.specialtyId ?? null,
        eloRoleId: updated.eloRoleId ?? null,
        reportRequiredDefault: updated.reportRequiredDefault,
        appliesToAllLocalities: updated.appliesToAllLocalities,
      },
    });

    return updated;
  }

  async cloneTaskTemplate(id: string, user?: RbacUser) {
    const template = await this.prisma.taskTemplate.findFirst({
      where: { id, deletedAt: null },
    });
    if (!template) throwError('NOT_FOUND');

    const cloned = await this.prisma.taskTemplate.create({
      data: {
        title: `${template.title} (copia)`,
        description: template.description,
        phaseId: template.phaseId,
        specialtyId: template.specialtyId,
        eloRoleId: template.eloRoleId,
        appliesToAllLocalities: template.appliesToAllLocalities,
        reportRequiredDefault: template.reportRequiredDefault,
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'task_templates',
      action: 'clone',
      entityId: cloned.id,
      diffJson: { sourceId: id },
    });

    return cloned;
  }

  async deleteTaskTemplate(id: string, user?: RbacUser) {
    this.assertTemplateManageAccess(user);

    const template = await this.prisma.taskTemplate.findFirst({
      where: { id },
      select: {
        id: true,
        title: true,
        deletedAt: true,
        _count: {
          select: {
            instances: true,
            checklistItems: true,
          },
        },
      },
    });
    if (!template) throwError('NOT_FOUND');
    if (template.deletedAt) return { ok: true };

    const linkedInstances = template._count.instances ?? 0;
    const linkedChecklistItems = template._count.checklistItems ?? 0;
    await this.prisma.taskTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'task_templates',
      action: 'delete',
      entityId: id,
      localityId: user?.localityId ?? undefined,
      diffJson: {
        title: template.title,
        softDeleted: true,
        linkedInstances,
        linkedChecklistItems,
      },
    });

    return { ok: true };
  }

  async generateInstances(
    templateId: string,
    payload: {
      localities: { localityId: string; dueDate: string }[];
      reportRequired?: boolean;
      priority?: TaskPriority | string;
      meetingId?: string | null;
      assignedToId?: string | null;
      assigneeIds?: string[];
    },
    user?: RbacUser,
  ) {
    const template = await this.prisma.taskTemplate.findFirst({
      where: { id: templateId, deletedAt: null },
    });
    if (!template) throwError('NOT_FOUND');

    const reportRequired =
      payload.reportRequired ?? template.reportRequiredDefault;
    const priority = (payload.priority as TaskPriority) ?? TaskPriority.MEDIUM;
    const groupKey = payload.localities.length > 1 ? randomUUID() : null;
    const responsibleIds = Array.from(
      new Set(
        (payload.assigneeIds ?? [])
          .map((value) => String(value ?? '').trim())
          .filter(Boolean),
      ),
    );
    if (
      payload.assignedToId &&
      !responsibleIds.includes(payload.assignedToId)
    ) {
      responsibleIds.push(payload.assignedToId);
    }

    const created = await this.prisma.$transaction(
      payload.localities.map((entry) =>
        this.prisma.taskInstance.create({
          data: {
            taskTemplateId: templateId,
            localityId: entry.localityId,
            specialtyId: template.specialtyId ?? null,
            dueDate: new Date(entry.dueDate),
            status: TaskStatus.NOT_STARTED,
            priority,
            progressPercent: 0,
            assignedToId: payload.assignedToId ?? null,
            assigneeType: payload.assignedToId ? TaskAssigneeType.USER : null,
            reportRequired,
            groupKey,
            meetingId: payload.meetingId ?? null,
            eloRoleId: template.eloRoleId ?? null,
            responsibles:
              responsibleIds.length > 0
                ? {
                    create: responsibleIds.map((userId) => ({
                      userId,
                      assignedById: user?.id ?? null,
                    })),
                  }
                : undefined,
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

    const items = await this.loadTaskInstancesMapped(
      created.map((row) => row.id),
      user,
    );
    return { items };
  }

  async createTaskInstancesManual(
    payload: {
      title: string;
      description?: string | null;
      phaseId: string;
      dueDate: string;
      priority?: TaskPriority | string;
      localityIds: string[];
      assignedToId?: string | null;
      assigneeIds?: string[];
    },
    user?: RbacUser,
  ) {
    const title = sanitizeText(String(payload.title ?? '').trim());
    if (!title) {
      throwError('VALIDATION_ERROR', {
        field: 'title',
        reason: 'REQUIRED',
      });
    }

    const dueDate = new Date(payload.dueDate);
    if (Number.isNaN(dueDate.getTime())) {
      throwError('VALIDATION_ERROR', {
        field: 'dueDate',
        reason: 'INVALID_DATE',
      });
    }

    const localityIds = Array.from(
      new Set(
        (payload.localityIds ?? [])
          .map((value) => String(value ?? '').trim())
          .filter(Boolean),
      ),
    );
    if (!localityIds.length) {
      throwError('VALIDATION_ERROR', {
        field: 'localityIds',
        reason: 'REQUIRED',
      });
    }

    const phaseId = String(payload.phaseId ?? '').trim();
    if (!phaseId) {
      throwError('VALIDATION_ERROR', {
        field: 'phaseId',
        reason: 'REQUIRED',
      });
    }

    const phase = await this.prisma.phase.findUnique({
      where: { id: phaseId },
      select: { id: true },
    });
    if (!phase) throwError('NOT_FOUND');

    const priorityValues = Object.values(TaskPriority);
    const priority = priorityValues.includes(payload.priority as TaskPriority)
      ? (payload.priority as TaskPriority)
      : TaskPriority.MEDIUM;

    for (const localityId of localityIds) {
      this.assertConstraints(localityId, null, user);
    }

    const normalizedAssigneeIds = Array.from(
      new Set(
        [payload.assignedToId, ...(payload.assigneeIds ?? [])]
          .map((value) => String(value ?? '').trim())
          .filter(Boolean),
      ),
    );

    if (normalizedAssigneeIds.length > 0) {
      for (const localityId of localityIds) {
        this.assertCanAssignInLocality(localityId, user);
      }
    }

    const users = normalizedAssigneeIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: normalizedAssigneeIds }, isActive: true },
          select: { id: true, localityId: true },
        })
      : [];
    if (users.length !== normalizedAssigneeIds.length) {
      throwError('NOT_FOUND');
    }

    const selectedAssignedToId = String(payload.assignedToId ?? '').trim();
    const template = await this.resolveManualTaskTemplate(phaseId);
    const groupKey = localityIds.length > 1 ? randomUUID() : null;

    const created = await this.prisma.$transaction(
      localityIds.map((localityId) => {
        const localityResponsibleIds = users
          .filter((candidate) => candidate.localityId === localityId)
          .map((candidate) => candidate.id);
        const assignedToId = users.some(
          (candidate) =>
            candidate.id === selectedAssignedToId &&
            candidate.localityId === localityId,
        )
          ? selectedAssignedToId
          : null;

        return this.prisma.taskInstance.create({
          data: {
            taskTemplateId: template.id,
            localityId,
            titleOverride: title,
            groupKey,
            dueDate,
            status: TaskStatus.NOT_STARTED,
            priority,
            progressPercent: 0,
            assignedToId: assignedToId || null,
            assigneeType: assignedToId ? TaskAssigneeType.USER : null,
            reportRequired: false,
            responsibles:
              localityResponsibleIds.length > 0
                ? {
                    create: localityResponsibleIds.map((userId) => ({
                      userId,
                      assignedById: user?.id ?? null,
                    })),
                  }
                : undefined,
          },
        });
      }),
    );

    await this.audit.log({
      userId: user?.id,
      resource: 'task_instances',
      action: 'create_batch_manual',
      localityId: user?.localityId ?? undefined,
      diffJson: {
        title,
        phaseId,
        count: created.length,
        localityIds,
      },
    });

    const items = await this.loadTaskInstancesMapped(
      created.map((row) => row.id),
      user,
    );
    return { items };
  }

  private async loadTaskInstancesMapped(
    ids: string[],
    user?: RbacUser,
  ): Promise<any[]> {
    if (!ids.length) return [];
    const rows = await this.prisma.taskInstance.findMany({
      where: { id: { in: ids } },
      orderBy: { dueDate: 'asc' },
      include: this.taskInstanceListInclude(),
    });
    const withComments = await this.attachTaskCommentSummary(rows, user);
    return withComments.map((item) =>
      this.mapTaskInstance(item, user?.executiveHidePii),
    );
  }

  /**
   * TI e comissão nacional: sem filtro por OM-alvo (tarefas em qualquer localidade aparecem).
   * Demais perfis: apenas OMs-alvo SMIF (mesma regra do painel nacional).
   */
  private async allowedLocalityIdsForTaskQueries(
    user?: RbacUser,
  ): Promise<string[] | undefined> {
    if (!user?.id) return this.getTargetLocalityIds();
    const profile = resolveAccessProfile(user);
    if (profile.ti || profile.nationalCommission) return undefined;
    return this.getTargetLocalityIds();
  }

  async listTaskInstances(
    filters: {
      localityId?: string;
      phaseId?: string;
      status?: string;
      assigneeId?: string;
      assigneeIds?: string;
      dueFrom?: string;
      dueTo?: string;
      meetingId?: string;
      eloRoleId?: string;
      specialtyId?: string;
      page?: string;
      pageSize?: string;
    },
    user?: RbacUser,
  ) {
    const allowedLocalityIds =
      await this.allowedLocalityIdsForTaskQueries(user);
    if (allowedLocalityIds !== undefined && allowedLocalityIds.length === 0) {
      const { page, pageSize } = this.parsePagination(
        filters.page,
        filters.pageSize,
      );
      return { items: [], page, pageSize, total: 0 };
    }
    const { where } = this.buildTaskWhere(
      { ...filters, allowedLocalityIds },
      user,
    );
    if (filters.meetingId) where.meetingId = filters.meetingId;
    if (filters.eloRoleId) where.eloRoleId = filters.eloRoleId;

    const finalWhere = await this.expandTaskWhereForSharedGroupKey(
      { ...filters, allowedLocalityIds },
      where,
      user,
    );

    const { page, pageSize, skip, take } = this.parsePagination(
      filters.page,
      filters.pageSize,
    );

    const listInclude = this.taskInstanceListInclude();

    const [items, total] = await this.prisma.$transaction([
      this.prisma.taskInstance.findMany({
        where: finalWhere,
        orderBy: { dueDate: 'asc' },
        skip,
        take,
        include: listInclude,
      }),
      this.prisma.taskInstance.count({ where: finalWhere }),
    ]);

    const mergedItems = await this.mergeTaskGroupSiblingsIntoPage(
      items,
      finalWhere,
    );

    const withCommentSummary = await this.attachTaskCommentSummary(
      mergedItems,
      user,
    );

    return {
      items: withCommentSummary.map((item) =>
        this.mapTaskInstance(item, user?.executiveHidePii),
      ),
      page,
      pageSize,
      total,
    };
  }

  async getTaskInstanceById(id: string, user?: RbacUser) {
    const instance = await this.prisma.taskInstance.findUnique({
      where: { id },
      include: {
        taskTemplate: {
          include: { phase: true, specialty: true, eloRole: true },
        },
        locality: true,
        specialty: { select: { id: true, name: true, color: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        assignedElo: {
          include: {
            eloRole: { select: { id: true, code: true, name: true } },
          },
        },
        responsibles: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                localityId: true,
                specialtyId: true,
                eloRoleId: true,
              },
            },
          },
          orderBy: [{ createdAt: 'asc' }],
        },
        meeting: { select: { id: true, datetime: true, scope: true } },
        eloRole: { select: { id: true, code: true, name: true } },
      },
    });
    if (!instance) throwError('NOT_FOUND');

    this.assertTaskViewAccess(instance, user);

    const [withCommentSummary] = await this.attachTaskCommentSummary(
      [instance],
      user,
    );
    return this.mapTaskInstance(withCommentSummary, user?.executiveHidePii);
  }

  async listComments(id: string, user?: RbacUser) {
    const instance = await this.prisma.taskInstance.findUnique({
      where: { id },
      include: {
        taskTemplate: { select: { specialtyId: true } },
        assignedElo: { select: { id: true, eloRoleId: true } },
        responsibles: { select: { userId: true } },
      },
    });
    if (!instance) throwError('NOT_FOUND');
    this.assertTaskViewAccess(instance, user);

    const [comments, readState] = await this.prisma.$transaction([
      this.prisma.taskComment.findMany({
        where: { taskInstanceId: id },
        include: { author: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      user?.id
        ? this.prisma.taskCommentRead.findUnique({
            where: {
              taskInstanceId_userId: { taskInstanceId: id, userId: user.id },
            },
          })
        : this.prisma.taskCommentRead.findFirst({
            where: { taskInstanceId: id, userId: '__none__' },
          }),
    ]);

    const seenAt = readState?.seenAt ?? null;
    const unread = user?.id
      ? comments.filter(
          (comment) =>
            comment.authorId !== user.id &&
            (!seenAt || comment.createdAt > seenAt),
        ).length
      : 0;

    return {
      items: comments.map((comment) =>
        this.mapTaskComment(comment, user?.executiveHidePii),
      ),
      summary: {
        total: comments.length,
        unread,
        hasUnread: unread > 0,
      },
    };
  }

  async addComment(id: string, text: string, user?: RbacUser) {
    if (!user?.id) throwError('RBAC_FORBIDDEN');

    const instance = await this.prisma.taskInstance.findUnique({
      where: { id },
      include: {
        taskTemplate: { select: { specialtyId: true } },
        assignedElo: { select: { id: true, eloRoleId: true } },
        responsibles: { select: { userId: true } },
      },
    });
    if (!instance) throwError('NOT_FOUND');
    this.assertTaskOperateAccess(instance, user);

    const normalized = this.sanitizeCommentText(text);
    if (!normalized) {
      throwError('VALIDATION_ERROR', {
        field: 'text',
        reason: 'COMMENT_REQUIRED',
      });
    }

    const created = await this.prisma.taskComment.create({
      data: {
        taskInstanceId: id,
        authorId: user.id,
        text: normalized,
      },
      include: { author: { select: { id: true, name: true, email: true } } },
    });

    await this.prisma.taskCommentRead.upsert({
      where: { taskInstanceId_userId: { taskInstanceId: id, userId: user.id } },
      update: { seenAt: new Date() },
      create: { taskInstanceId: id, userId: user.id, seenAt: new Date() },
    });

    await this.audit.log({
      userId: user.id,
      resource: 'task_comments',
      action: 'create',
      entityId: created.id,
      localityId: instance.localityId,
      diffJson: { taskInstanceId: id },
    });

    return this.mapTaskComment(created, user?.executiveHidePii);
  }

  async markCommentsSeen(id: string, user?: RbacUser) {
    if (!user?.id) throwError('RBAC_FORBIDDEN');
    const instance = await this.prisma.taskInstance.findUnique({
      where: { id },
      include: {
        taskTemplate: { select: { specialtyId: true } },
        assignedElo: { select: { id: true, eloRoleId: true } },
        responsibles: { select: { userId: true } },
      },
    });
    if (!instance) throwError('NOT_FOUND');
    this.assertTaskViewAccess(instance, user);

    const seenAt = new Date();
    await this.prisma.taskCommentRead.upsert({
      where: { taskInstanceId_userId: { taskInstanceId: id, userId: user.id } },
      update: { seenAt },
      create: { taskInstanceId: id, userId: user.id, seenAt },
    });
    return { ok: true, seenAt };
  }

  async updateStatus(id: string, status: TaskStatus, user?: RbacUser) {
    const instance = await this.prisma.taskInstance.findUnique({
      where: { id },
      include: {
        taskTemplate: { select: { specialtyId: true } },
        assignedElo: { select: { id: true, eloRoleId: true } },
        responsibles: { select: { userId: true } },
      },
    });
    if (!instance) throwError('NOT_FOUND');
    this.assertTaskOperateAccess(instance, user);

    const progressPercent = this.applyProgressRules(
      status,
      instance.progressPercent,
    );

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
      include: {
        taskTemplate: { select: { specialtyId: true } },
        assignedElo: { select: { id: true, eloRoleId: true } },
        responsibles: { select: { userId: true } },
      },
    });
    if (!instance) throwError('NOT_FOUND');
    this.assertTaskOperateAccess(instance, user);

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

  async updateTaskTitle(id: string, title: string, user?: RbacUser) {
    const instance = await this.prisma.taskInstance.findUnique({
      where: { id },
      include: {
        taskTemplate: { select: { specialtyId: true } },
        assignedElo: { select: { id: true, eloRoleId: true } },
        responsibles: { select: { userId: true } },
      },
    });
    if (!instance) throwError('NOT_FOUND');
    this.assertTaskOperateAccess(instance, user);

    const normalizedTitle = sanitizeText(String(title ?? '').trim());
    if (!normalizedTitle) {
      throwError('VALIDATION_ERROR', {
        field: 'title',
        reason: 'REQUIRED',
      });
    }

    const updated = await this.prisma.taskInstance.update({
      where: { id },
      data: { titleOverride: normalizedTitle },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'task_instances',
      action: 'update_title',
      entityId: id,
      localityId: instance.localityId,
      diffJson: { title: normalizedTitle },
    });

    return this.mapTaskInstance(updated, user?.executiveHidePii);
  }

  async listAssignees(localityIdRaw?: string, user?: RbacUser) {
    const localityId = localityIdRaw?.trim();
    if (!localityId) {
      return { localityId: null, localityName: null, items: [] };
    }
    this.assertCanAssignInLocality(localityId, user);

    const [locality, users, elos] = await this.prisma.$transaction([
      this.prisma.locality.findUnique({
        where: { id: localityId },
        select: {
          id: true,
          name: true,
          commandName: true,
          commanderName: true,
        },
      }),
      this.prisma.user.findMany({
        where: {
          localityId,
          isActive: true,
          ldapUid: { not: null },
          roles: { some: {} },
        },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          email: true,
          eloRole: { select: { name: true, code: true } },
        },
      }),
      this.prisma.elo.findMany({
        where: { localityId },
        orderBy: [{ eloRole: { sortOrder: 'asc' } }, { name: 'asc' }],
        include: { eloRole: { select: { id: true, code: true, name: true } } },
      }),
    ]);

    if (!locality) throwError('NOT_FOUND');

    const items: Array<{
      type: string;
      id: string;
      label: string;
      subtitle?: string;
    }> = [];

    for (const u of users) {
      items.push({
        type: TaskAssigneeType.USER,
        id: u.id,
        label: u.name || u.email,
        subtitle: u.eloRole?.name ? `Usuário • ${u.eloRole.name}` : 'Usuário',
      });
    }

    for (const elo of elos) {
      items.push({
        type: TaskAssigneeType.ELO,
        id: elo.id,
        label: elo.name,
        subtitle: elo.eloRole?.name ?? elo.eloRole?.code ?? 'Elo',
      });
    }

    if (locality.commandName) {
      items.push({
        type: TaskAssigneeType.LOCALITY_COMMAND,
        id: 'LOCALITY_COMMAND',
        label: locality.commandName,
        subtitle: 'GSD / Comando',
      });
    }

    if (locality.commanderName) {
      items.push({
        type: TaskAssigneeType.LOCALITY_COMMANDER,
        id: 'LOCALITY_COMMANDER',
        label: locality.commanderName,
        subtitle: 'Comandante',
      });
    }

    return {
      localityId: locality.id,
      localityName: locality.name,
      items,
    };
  }

  async listAssignableUsers(user?: RbacUser) {
    if (!user?.id) throwError('RBAC_FORBIDDEN');

    const profile = resolveAccessProfile(user);
    const where: Prisma.UserWhereInput = {
      isActive: true,
      ldapUid: { not: null },
      roles: { some: {} },
    };

    if (!profile.ti && !profile.nationalCommission) {
      if (!profile.localityId) {
        return { items: [] as Array<Record<string, unknown>> };
      }
      where.localityId = profile.localityId;
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        localityId: true,
      },
    });

    return {
      items: users.map((item) => ({
        id: item.id,
        name: item.name || item.email || `Usuário ${item.id.slice(0, 8)}`,
        localityId: item.localityId ?? null,
      })),
    };
  }

  async assignTask(
    id: string,
    payload: {
      assigneeIds?: string[];
      assignedToId?: string | null;
      localityId?: string | null;
      assigneeType?:
        | 'USER'
        | 'ELO'
        | 'LOCALITY_COMMAND'
        | 'LOCALITY_COMMANDER'
        | null;
      assigneeId?: string | null;
    },
    user?: RbacUser,
  ) {
    const instance = await this.prisma.taskInstance.findUnique({
      where: { id },
      include: {
        taskTemplate: { select: { specialtyId: true } },
        assignedElo: { select: { id: true, eloRoleId: true } },
        responsibles: { select: { userId: true } },
        meeting: { select: { id: true, localityId: true } },
      },
    });
    if (!instance) throwError('NOT_FOUND');

    const targetLocalityId = payload.localityId?.trim() || instance.localityId;
    this.assertCanAssignInTaskScope(
      {
        localityId: targetLocalityId,
        specialtyId:
          instance.specialtyId ?? instance.taskTemplate?.specialtyId ?? null,
        taskTemplate: {
          specialtyId: instance.taskTemplate?.specialtyId ?? null,
        },
        eloRoleId: instance.eloRoleId ?? null,
        assignedElo: instance.assignedElo,
      },
      user,
    );

    const selection = this.normalizeAssigneeSelection(payload);
    let assignedToId: string | null = null;
    let assignedEloId: string | null = null;
    let assigneeType: TaskAssigneeType | null = null;
    let externalAssigneeName: string | null = null;
    let externalAssigneeRole: string | null = null;

    if (selection.type === TaskAssigneeType.USER && selection.id) {
      const targetUser = await this.prisma.user.findUnique({
        where: { id: selection.id },
        select: {
          id: true,
          localityId: true,
          specialtyId: true,
          eloRoleId: true,
          isActive: true,
        },
      });
      if (!targetUser) throwError('NOT_FOUND');
      if (!targetUser.isActive) throwError('RBAC_FORBIDDEN');
      if (targetUser.localityId !== targetLocalityId) {
        throwError('RBAC_FORBIDDEN');
      }
      assignedToId = targetUser.id;
      assigneeType = TaskAssigneeType.USER;
    } else if (selection.type === TaskAssigneeType.ELO && selection.id) {
      const targetElo = await this.prisma.elo.findUnique({
        where: { id: selection.id },
        select: {
          id: true,
          localityId: true,
          name: true,
          eloRole: { select: { name: true, code: true } },
        },
      });
      if (!targetElo) throwError('NOT_FOUND');
      if (targetElo.localityId !== targetLocalityId) {
        throwError('RBAC_FORBIDDEN');
      }
      assignedEloId = targetElo.id;
      assigneeType = TaskAssigneeType.ELO;
    } else if (selection.type === TaskAssigneeType.LOCALITY_COMMAND) {
      const locality = await this.prisma.locality.findUnique({
        where: { id: targetLocalityId },
        select: { commandName: true },
      });
      externalAssigneeName = locality?.commandName?.trim() ?? null;
      externalAssigneeRole = externalAssigneeName ? 'GSD / Comando' : null;
      assigneeType = externalAssigneeName
        ? TaskAssigneeType.LOCALITY_COMMAND
        : null;
    } else if (selection.type === TaskAssigneeType.LOCALITY_COMMANDER) {
      const locality = await this.prisma.locality.findUnique({
        where: { id: targetLocalityId },
        select: { commanderName: true },
      });
      externalAssigneeName = locality?.commanderName?.trim() ?? null;
      externalAssigneeRole = externalAssigneeName ? 'Comandante' : null;
      assigneeType = externalAssigneeName
        ? TaskAssigneeType.LOCALITY_COMMANDER
        : null;
    }

    const keepMeeting =
      !instance.meeting ||
      !instance.meeting.localityId ||
      instance.meeting.localityId === targetLocalityId;

    const responsibleIds = await this.resolveTaskResponsibleIds(
      targetLocalityId,
      {
        assigneeIds: payload.assigneeIds,
        assignedToId,
        selectionType: selection.type,
      },
      user,
    );

    const updated = await this.prisma.taskInstance.update({
      where: { id },
      data: {
        localityId: targetLocalityId,
        meetingId: keepMeeting ? instance.meetingId : null,
        assignedToId,
        assignedEloId,
        assigneeType,
        externalAssigneeName,
        externalAssigneeRole,
        responsibles: {
          deleteMany: {},
          ...(responsibleIds.length > 0
            ? {
                create: responsibleIds.map((userId) => ({
                  userId,
                  assignedById: user?.id ?? null,
                })),
              }
            : {}),
        },
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        assignedElo: {
          include: {
            eloRole: { select: { id: true, code: true, name: true } },
          },
        },
        responsibles: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                localityId: true,
                specialtyId: true,
                eloRoleId: true,
              },
            },
          },
          orderBy: [{ createdAt: 'asc' }],
        },
        meeting: { select: { id: true, datetime: true, scope: true } },
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'task_instances',
      action: 'assign',
      entityId: id,
      localityId: targetLocalityId,
      diffJson: {
        localityId: targetLocalityId,
        assigneeType,
        assignedToId,
        assignedEloId,
        responsibleIds,
        externalAssigneeName,
      },
    });

    return this.mapTaskInstance(updated, user?.executiveHidePii);
  }

  async updateTaskLocalities(
    id: string,
    localityIdsRaw: string[],
    sourceTaskIdsRaw: string[] = [],
    user?: RbacUser,
  ) {
    const desiredLocalityIds = Array.from(
      new Set(
        (localityIdsRaw ?? [])
          .map((value) => String(value ?? '').trim())
          .filter(Boolean),
      ),
    );
    if (!desiredLocalityIds.length) {
      throwError('VALIDATION_ERROR', {
        field: 'localityIds',
        reason: 'required',
      });
    }

    const baseInstance = await this.prisma.taskInstance.findUnique({
      where: { id },
      include: {
        taskTemplate: { select: { id: true, specialtyId: true } },
        assignedTo: { select: { id: true, localityId: true } },
        assignedElo: { select: { id: true, localityId: true } },
        responsibles: {
          include: { user: { select: { id: true, localityId: true } } },
          orderBy: [{ createdAt: 'asc' }],
        },
        meeting: { select: { id: true, localityId: true } },
      },
    });
    if (!baseInstance) throwError('NOT_FOUND');
    this.assertTaskOperateAccess(baseInstance, user);

    const baseSpecialtyId =
      baseInstance.specialtyId ??
      baseInstance.taskTemplate?.specialtyId ??
      null;
    for (const localityId of desiredLocalityIds) {
      this.assertConstraints(localityId, baseSpecialtyId, user);
      this.assertCanAssignInLocality(localityId, user);
    }

    const sourceTaskIds = Array.from(
      new Set(
        [id, ...(sourceTaskIdsRaw ?? [])]
          .map((value) => String(value ?? '').trim())
          .filter(Boolean),
      ),
    );

    let sourceInstances =
      sourceTaskIds.length > 1
        ? await this.prisma.taskInstance.findMany({
            where: { id: { in: sourceTaskIds } },
            include: {
              taskTemplate: { select: { specialtyId: true } },
              assignedElo: { select: { id: true, eloRoleId: true } },
              responsibles: { select: { userId: true } },
            },
          })
        : [];

    if (sourceInstances.length <= 1 && baseInstance.groupKey) {
      sourceInstances = await this.prisma.taskInstance.findMany({
        where: { groupKey: baseInstance.groupKey },
        include: {
          taskTemplate: { select: { specialtyId: true } },
          assignedElo: { select: { id: true, eloRoleId: true } },
          responsibles: { select: { userId: true } },
        },
      });
    }

    if (sourceInstances.length === 0) {
      sourceInstances = [
        {
          ...baseInstance,
          taskTemplate: {
            specialtyId: baseInstance.taskTemplate?.specialtyId ?? null,
          },
          assignedElo: baseInstance.assignedElo
            ? { id: baseInstance.assignedElo.id, eloRoleId: null }
            : null,
          responsibles: baseInstance.responsibles.map((entry) => ({
            userId: entry.userId,
          })),
        } as any,
      ];
    }

    for (const instance of sourceInstances) {
      this.assertTaskOperateAccess(instance, user);
      if (instance.taskTemplateId !== baseInstance.taskTemplateId) {
        throwError('VALIDATION_ERROR', {
          field: 'sourceTaskIds',
          reason: 'TASK_LOCALITIES_GROUP_MISMATCH',
        });
      }
    }

    const primaryLocalityId = desiredLocalityIds.includes(
      baseInstance.localityId,
    )
      ? baseInstance.localityId
      : desiredLocalityIds[0];

    const localityRecords = await this.prisma.locality.findMany({
      where: {
        id: { in: desiredLocalityIds },
        catalogType: LocalityCatalogType.SMIF,
      },
      select: { id: true, commandName: true, commanderName: true },
    });
    if (localityRecords.length !== desiredLocalityIds.length) {
      throwError('NOT_FOUND');
    }
    const localityById = new Map(
      localityRecords.map((locality) => [locality.id, locality]),
    );

    const resolveAssignmentForLocality = (localityId: string) => {
      const locality = localityById.get(localityId);
      if (!locality) throwError('NOT_FOUND');

      const assignedToId =
        baseInstance.assignedToId &&
        baseInstance.assignedTo?.localityId === localityId
          ? baseInstance.assignedToId
          : null;
      const assignedEloId =
        baseInstance.assignedEloId &&
        baseInstance.assignedElo?.localityId === localityId
          ? baseInstance.assignedEloId
          : null;

      const responsibles = (baseInstance.responsibles ?? [])
        .filter((entry: any) => entry?.user?.localityId === localityId)
        .map((entry: any) => String(entry.userId ?? '').trim())
        .filter(Boolean);

      if (assignedToId) {
        return {
          assignedToId,
          assignedEloId: null,
          assigneeType: TaskAssigneeType.USER as TaskAssigneeType | null,
          externalAssigneeName: null as string | null,
          externalAssigneeRole: null as string | null,
          responsibles,
          meetingId:
            !baseInstance.meeting ||
            !baseInstance.meeting.localityId ||
            baseInstance.meeting.localityId === localityId
              ? baseInstance.meetingId
              : null,
        };
      }
      if (assignedEloId) {
        return {
          assignedToId: null,
          assignedEloId,
          assigneeType: TaskAssigneeType.ELO as TaskAssigneeType | null,
          externalAssigneeName: null as string | null,
          externalAssigneeRole: null as string | null,
          responsibles,
          meetingId:
            !baseInstance.meeting ||
            !baseInstance.meeting.localityId ||
            baseInstance.meeting.localityId === localityId
              ? baseInstance.meetingId
              : null,
        };
      }
      if (baseInstance.assigneeType === TaskAssigneeType.LOCALITY_COMMAND) {
        const name = locality.commandName?.trim() || null;
        return {
          assignedToId: null,
          assignedEloId: null,
          assigneeType: name ? TaskAssigneeType.LOCALITY_COMMAND : null,
          externalAssigneeName: name,
          externalAssigneeRole: name ? 'GSD / Comando' : null,
          responsibles: [] as string[],
          meetingId:
            !baseInstance.meeting ||
            !baseInstance.meeting.localityId ||
            baseInstance.meeting.localityId === localityId
              ? baseInstance.meetingId
              : null,
        };
      }
      if (baseInstance.assigneeType === TaskAssigneeType.LOCALITY_COMMANDER) {
        const name = locality.commanderName?.trim() || null;
        return {
          assignedToId: null,
          assignedEloId: null,
          assigneeType: name ? TaskAssigneeType.LOCALITY_COMMANDER : null,
          externalAssigneeName: name,
          externalAssigneeRole: name ? 'Comandante' : null,
          responsibles: [] as string[],
          meetingId:
            !baseInstance.meeting ||
            !baseInstance.meeting.localityId ||
            baseInstance.meeting.localityId === localityId
              ? baseInstance.meetingId
              : null,
        };
      }

      return {
        assignedToId: null,
        assignedEloId: null,
        assigneeType: null as TaskAssigneeType | null,
        externalAssigneeName: null as string | null,
        externalAssigneeRole: null as string | null,
        responsibles: [] as string[],
        meetingId:
          !baseInstance.meeting ||
          !baseInstance.meeting.localityId ||
          baseInstance.meeting.localityId === localityId
            ? baseInstance.meetingId
            : null,
      };
    };

    const nonPrimarySource = sourceInstances
      .filter((instance) => instance.id !== baseInstance.id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const reusableByLocality = new Map<string, any>();
    nonPrimarySource.forEach((instance) => {
      if (!reusableByLocality.has(instance.localityId)) {
        reusableByLocality.set(instance.localityId, instance);
      }
    });

    const keptIds = new Set<string>([baseInstance.id]);
    const keptLocalityIds = new Set<string>([primaryLocalityId]);
    const missingLocalityIds: string[] = [];
    const deletedIds = new Set<string>();

    for (const localityId of desiredLocalityIds) {
      if (localityId === primaryLocalityId) continue;
      const reusable = reusableByLocality.get(localityId);
      if (reusable) {
        keptIds.add(reusable.id);
        keptLocalityIds.add(localityId);
        reusableByLocality.delete(localityId);
      } else {
        missingLocalityIds.push(localityId);
      }
    }

    for (const instance of nonPrimarySource) {
      if (!keptIds.has(instance.id)) deletedIds.add(instance.id);
    }

    const persisted = await this.prisma.$transaction(async (tx) => {
      const createdIds: string[] = [];

      if (baseInstance.localityId !== primaryLocalityId) {
        const assignment = resolveAssignmentForLocality(primaryLocalityId);
        await tx.taskInstance.update({
          where: { id: baseInstance.id },
          data: {
            localityId: primaryLocalityId,
            meetingId: assignment.meetingId,
            assignedToId: assignment.assignedToId,
            assignedEloId: assignment.assignedEloId,
            assigneeType: assignment.assigneeType,
            externalAssigneeName: assignment.externalAssigneeName,
            externalAssigneeRole: assignment.externalAssigneeRole,
            responsibles: {
              deleteMany: {},
              ...(assignment.responsibles.length > 0
                ? {
                    create: assignment.responsibles.map((userId) => ({
                      userId,
                      assignedById: user?.id ?? null,
                    })),
                  }
                : {}),
            },
          },
        });
      }

      for (const localityId of missingLocalityIds) {
        const assignment = resolveAssignmentForLocality(localityId);
        const created = await tx.taskInstance.create({
          data: {
            taskTemplateId: baseInstance.taskTemplateId,
            localityId,
            specialtyId: baseInstance.specialtyId,
            dueDate: baseInstance.dueDate,
            status: baseInstance.status,
            priority: baseInstance.priority,
            progressPercent: baseInstance.progressPercent,
            reportRequired: baseInstance.reportRequired,
            titleOverride: baseInstance.titleOverride,
            meetingId: assignment.meetingId,
            assignedToId: assignment.assignedToId,
            assignedEloId: assignment.assignedEloId,
            assigneeType: assignment.assigneeType,
            externalAssigneeName: assignment.externalAssigneeName,
            externalAssigneeRole: assignment.externalAssigneeRole,
            groupKey: null,
            eloRoleId: baseInstance.eloRoleId,
            responsibles:
              assignment.responsibles.length > 0
                ? {
                    create: assignment.responsibles.map((userId) => ({
                      userId,
                      assignedById: user?.id ?? null,
                    })),
                  }
                : undefined,
          },
          select: { id: true },
        });
        createdIds.push(created.id);
      }

      const idsToDelete = Array.from(deletedIds);
      if (idsToDelete.length > 0) {
        await tx.taskCommentRead.deleteMany({
          where: { taskInstanceId: { in: idsToDelete } },
        });
        await tx.taskComment.deleteMany({
          where: { taskInstanceId: { in: idsToDelete } },
        });
        await tx.taskResponsible.deleteMany({
          where: { taskInstanceId: { in: idsToDelete } },
        });
        await tx.report.deleteMany({
          where: { taskInstanceId: { in: idsToDelete } },
        });
        await tx.taskInstance.deleteMany({
          where: { id: { in: idsToDelete } },
        });
      }

      const finalIds = Array.from(
        new Set([baseInstance.id, ...Array.from(keptIds), ...createdIds]),
      );
      const nextGroupKey =
        finalIds.length > 1
          ? String(baseInstance.groupKey ?? '').trim() || randomUUID()
          : null;
      await tx.taskInstance.updateMany({
        where: { id: { in: finalIds } },
        data: { groupKey: nextGroupKey },
      });

      return { finalIds, nextGroupKey };
    });

    const updated = await this.prisma.taskInstance.findMany({
      where: { id: { in: persisted.finalIds } },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      include: {
        locality: { select: { id: true, name: true, code: true } },
        specialty: { select: { id: true, name: true, color: true } },
        taskTemplate: { select: { id: true, title: true, phaseId: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        assignedElo: {
          include: {
            eloRole: { select: { id: true, code: true, name: true } },
          },
        },
        responsibles: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                localityId: true,
                specialtyId: true,
                eloRoleId: true,
              },
            },
          },
          orderBy: [{ createdAt: 'asc' }],
        },
        meeting: { select: { id: true, datetime: true, scope: true } },
        eloRole: { select: { id: true, code: true, name: true } },
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'task_instances',
      action: 'update_localities',
      entityId: id,
      localityId: primaryLocalityId,
      diffJson: {
        sourceTaskIds: sourceTaskIds,
        keptTaskIds: Array.from(keptIds),
        deletedTaskIds: Array.from(deletedIds),
        localityIds: desiredLocalityIds,
        groupKey: persisted.nextGroupKey,
      },
    });

    return {
      primaryTaskId: id,
      items: updated.map((item) =>
        this.mapTaskInstance(item, user?.executiveHidePii),
      ),
    };
  }

  async batchAssign(
    ids: string[],
    assignedToId: string | null,
    assigneeIds: string[] = [],
    user?: RbacUser,
  ) {
    const instances = await this.prisma.taskInstance.findMany({
      where: { id: { in: ids } },
      include: {
        taskTemplate: { select: { specialtyId: true } },
        assignedElo: { select: { id: true, eloRoleId: true } },
      },
    });
    for (const instance of instances) {
      this.assertCanAssignInTaskScope(instance, user);
    }

    const normalized = Array.from(
      new Set(
        [assignedToId, ...assigneeIds]
          .map((value) => String(value ?? '').trim())
          .filter(Boolean),
      ),
    );

    const users = normalized.length
      ? await this.prisma.user.findMany({
          where: { id: { in: normalized }, isActive: true },
          select: { id: true, localityId: true },
        })
      : [];

    if (users.length !== normalized.length) {
      throwError('NOT_FOUND');
    }

    await this.prisma.taskInstance.updateMany({
      where: { id: { in: ids } },
      data: {
        assignedToId,
        assignedEloId: null,
        assigneeType: assignedToId ? TaskAssigneeType.USER : null,
        externalAssigneeName: null,
        externalAssigneeRole: null,
      },
    });

    for (const instance of instances) {
      const localityResponsibleIds = users
        .filter((candidate) => candidate.localityId === instance.localityId)
        .map((candidate) => candidate.id);
      await this.prisma.taskResponsible.deleteMany({
        where: { taskInstanceId: instance.id },
      });
      if (localityResponsibleIds.length > 0) {
        await this.prisma.taskResponsible.createMany({
          data: localityResponsibleIds.map((userId) => ({
            taskInstanceId: instance.id,
            userId,
            assignedById: user?.id ?? null,
          })),
          skipDuplicates: true,
        });
      }
    }

    await this.audit.log({
      userId: user?.id,
      resource: 'task_instances',
      action: 'batch_assign',
      diffJson: { count: ids.length, assignedToId, assigneeIds: normalized },
    });

    return { updated: ids.length };
  }

  async batchStatus(ids: string[], status: TaskStatus, user?: RbacUser) {
    const instances = await this.prisma.taskInstance.findMany({
      where: { id: { in: ids } },
      include: {
        taskTemplate: { select: { specialtyId: true } },
        assignedElo: { select: { id: true, eloRoleId: true } },
        responsibles: { select: { userId: true } },
      },
    });

    for (const instance of instances) {
      this.assertTaskOperateAccess(instance, user);
    }

    await this.prisma.taskInstance.updateMany({
      where: { id: { in: ids } },
      data: { status, progressPercent: this.applyProgressRules(status, 100) },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'task_instances',
      action: 'batch_status',
      diffJson: { count: ids.length, status },
    });

    return { updated: ids.length };
  }

  async batchProgress(ids: string[], progressPercent: number, user?: RbacUser) {
    const instances = await this.prisma.taskInstance.findMany({
      where: { id: { in: ids } },
      include: {
        taskTemplate: { select: { specialtyId: true } },
        assignedElo: { select: { id: true, eloRoleId: true } },
        responsibles: { select: { userId: true } },
      },
    });

    for (const instance of instances) {
      this.assertTaskOperateAccess(instance, user);
    }

    await this.prisma.$transaction(
      instances.map((instance) =>
        this.prisma.taskInstance.update({
          where: { id: instance.id },
          data: {
            progressPercent: this.applyProgressRules(
              instance.status,
              progressPercent,
            ),
          },
        }),
      ),
    );

    await this.audit.log({
      userId: user?.id,
      resource: 'task_instances',
      action: 'batch_progress',
      diffJson: { count: ids.length, progressPercent },
    });

    return { updated: ids.length };
  }

  async batchDeleteTaskInstances(ids: string[], user?: RbacUser) {
    const normalizedIds = Array.from(
      new Set(
        (ids ?? []).map((value) => String(value ?? '').trim()).filter(Boolean),
      ),
    );
    if (!normalizedIds.length) {
      return { deleted: 0 };
    }

    const existing = await this.prisma.taskInstance.findMany({
      where: { id: { in: normalizedIds } },
      select: {
        id: true,
        localityId: true,
        taskTemplate: { select: { title: true } },
      },
    });
    if (!existing.length) {
      return { deleted: 0 };
    }

    this.assertDeleteAccess(user);

    await this.prisma.$transaction([
      this.prisma.taskCommentRead.deleteMany({
        where: { taskInstanceId: { in: normalizedIds } },
      }),
      this.prisma.taskComment.deleteMany({
        where: { taskInstanceId: { in: normalizedIds } },
      }),
      this.prisma.taskResponsible.deleteMany({
        where: { taskInstanceId: { in: normalizedIds } },
      }),
      this.prisma.report.deleteMany({
        where: { taskInstanceId: { in: normalizedIds } },
      }),
      this.prisma.taskInstance.deleteMany({
        where: { id: { in: normalizedIds } },
      }),
    ]);

    await this.audit.log({
      userId: user?.id,
      resource: 'task_instances',
      action: 'batch_delete',
      diffJson: {
        count: existing.length,
        ids: existing.map((item) => item.id),
      },
    });

    return { deleted: existing.length };
  }

  async getGantt(
    params: { localityId?: string; from?: string; to?: string },
    user?: RbacUser,
  ) {
    const allowedLocalityIds =
      await this.allowedLocalityIdsForTaskQueries(user);
    if (allowedLocalityIds !== undefined && allowedLocalityIds.length === 0) {
      return { items: [] };
    }
    const andClauses: Prisma.TaskInstanceWhereInput[] = [];
    if (allowedLocalityIds !== undefined) {
      andClauses.push({ localityId: { in: allowedLocalityIds } });
    }
    if (params.localityId) andClauses.push({ localityId: params.localityId });
    if (params.from || params.to) {
      const dueDate: Prisma.DateTimeFilter = {};
      if (params.from) dueDate.gte = new Date(params.from);
      if (params.to) dueDate.lte = new Date(params.to);
      andClauses.push({ dueDate });
    }

    const accessWhere = this.buildTaskAccessWhere(user, 'view');
    if (Object.keys(accessWhere).length > 0) andClauses.push(accessWhere);
    const where: Prisma.TaskInstanceWhereInput =
      andClauses.length > 0 ? { AND: andClauses } : {};

    const items = await this.prisma.taskInstance.findMany({
      where,
      include: {
        locality: { select: { id: true, name: true, code: true } },
        taskTemplate: {
          select: {
            id: true,
            title: true,
            phaseId: true,
            phase: { select: { id: true, name: true, displayName: true } },
          },
        },
      },
    });
    return {
      items: items.map((item) =>
        this.mapTaskInstance(item, user?.executiveHidePii),
      ),
    };
  }

  async getCalendar(year: number, localityId?: string, user?: RbacUser) {
    const allowedLocalityIds =
      await this.allowedLocalityIdsForTaskQueries(user);
    if (allowedLocalityIds !== undefined && allowedLocalityIds.length === 0) {
      return { items: [] };
    }
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));

    const andClauses: Prisma.TaskInstanceWhereInput[] = [
      { dueDate: { gte: start, lt: end } },
    ];
    if (allowedLocalityIds !== undefined) {
      andClauses.push({ localityId: { in: allowedLocalityIds } });
    }
    if (localityId) andClauses.push({ localityId });
    const accessWhere = this.buildTaskAccessWhere(user, 'view');
    if (Object.keys(accessWhere).length > 0) andClauses.push(accessWhere);
    const where: Prisma.TaskInstanceWhereInput = { AND: andClauses };

    const items = await this.prisma.taskInstance.findMany({
      where,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      include: { taskTemplate: { include: { phase: true } } },
    });

    const uniqueByCalendarKey = new Map<string, (typeof items)[number]>();
    for (const item of items) {
      const groupKey = String(item.groupKey ?? '').trim();
      const calendarKey = groupKey ? `group:${groupKey}` : `task:${item.id}`;
      if (!uniqueByCalendarKey.has(calendarKey)) {
        uniqueByCalendarKey.set(calendarKey, item);
      }
    }
    const dedupedItems = Array.from(uniqueByCalendarKey.values());

    return {
      items: dedupedItems.map((item) => ({
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
      taskWhere.OR = [
        { specialtyId: null },
        { specialtyId: constraints.specialtyId },
      ];
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

    const phaseEntries = Array.from(byPhase.entries()).map(
      ([phaseName, stats]) => ({
        phaseName,
        progress: stats.count === 0 ? 0 : stats.total / stats.count,
      }),
    );

    const overallProgress =
      phaseEntries.length === 0
        ? 0
        : phaseEntries.reduce((acc, entry) => acc + entry.progress, 0) /
          phaseEntries.length;

    return {
      localityId,
      overallProgress,
      byPhase: phaseEntries,
    };
  }

  async getDashboardNational(user?: RbacUser, localityId?: string) {
    const where: Prisma.LocalityWhereInput = {};
    const constraints = this.getScopeConstraints(user);
    if (
      constraints.localityId &&
      localityId &&
      constraints.localityId !== localityId
    ) {
      where.id = '__none__';
    } else if (constraints.localityId) {
      where.id = constraints.localityId;
    } else if (localityId) {
      where.id = localityId;
    }

    const rawLocalities = await this.prisma.locality.findMany({
      where: { ...where, catalogType: LocalityCatalogType.SMIF },
      select: {
        id: true,
        name: true,
        code: true,
        recruitsFemaleCountCurrent: true,
        commanderName: true,
        individualMeetingDate: true,
        visitDate: true,
        commandName: true,
        notes: true,
        updatedAt: true,
      },
    });
    const localityGroups = groupTargetLocalities(rawLocalities);
    const localities = localityGroups.map((group) => group.canonical);
    if (localities.length === 0) {
      return {
        items: [],
        totals: {
          localities: 0,
          coverageLocalities: 0,
          late: 0,
          blocked: 0,
          unassigned: 0,
          recruitsFemale: 0,
          reportsProduced: 0,
          smifNewsCount: 0,
          visitsCompleted: 0,
          completedReports: 0,
          completedTasks: 0,
          completedFieldActivities: 0,
          completedVisits: 0,
          completedLectures: 0,
          completedBestPracticeCycles: 0,
          completedMappings: 0,
          fieldActivitiesBySpecialty: {
            psychology: 0,
            socialService: 0,
            doctrine: 0,
            law: 0,
          },
          participantsKpis: {
            instructors: 0,
            recruits: 0,
            eloPsychology: 0,
            eloSocialAssistance: 0,
            eloGraduadoMaster: 0,
          },
          participants: {
            instructors: 0,
            recruits: 0,
            elos: 0,
            graduadosMaster: 0,
          },
        },
        drilldown: {
          participants: {
            instructors: [],
            recruits: [],
            elos: [],
            graduadosMaster: [],
          },
          completedReports: [],
          completedTasks: [],
          completedFieldActivities: [],
          completedVisits: [],
          completedLectures: [],
          completedBestPracticeCycles: [],
          completedMappings: [],
          fieldActivitiesBySpecialty: {
            psychology: [],
            socialService: [],
            doctrine: [],
            law: [],
          },
        },
        lateItems: [],
        unassignedItems: [],
        riskTasks: [],
        executive_hide_pii: user?.executiveHidePii ?? false,
      };
    }
    const { aliasByLocalityId } = createTargetLocalityAliasMap(localityGroups);
    const localityAliasIds = Array.from(aliasByLocalityId.keys());
    const activityWhereClauses: Prisma.ActivityWhereInput[] = [];
    if (localityAliasIds.length === 0) {
      activityWhereClauses.push({ localityId: '__none__' });
    } else {
      activityWhereClauses.push({ localityId: { in: localityAliasIds } });
    }
    activityWhereClauses.push({ scope: ActivityScope.SMIF });
    if (constraints.specialtyId) {
      activityWhereClauses.push({
        OR: [
          { specialtyId: null },
          { specialtyId: constraints.specialtyId },
          { specialties: { some: { specialtyId: constraints.specialtyId } } },
        ],
      } as any);
    }
    const activityWhere: Prisma.ActivityWhereInput =
      activityWhereClauses.length === 1
        ? activityWhereClauses[0]
        : { AND: activityWhereClauses };

    const activities: any[] = await this.prisma.activity.findMany({
      where: activityWhere,
      include: {
        locality: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        specialty: {
          select: {
            id: true,
            name: true,
          },
        },
        specialties: {
          select: {
            specialtyId: true,
            specialty: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        activityType: {
          select: {
            id: true,
            name: true,
          },
        },
        responsibles: {
          select: {
            userId: true,
          },
        },
        report: {
          select: {
            id: true,
            date: true,
            location: true,
            responsible: true,
            missionSupport: true,
            introduction: true,
            missionObjectives: true,
            executionSchedule: true,
            activitiesPerformed: true,
            participantsCount: true,
            participantsMaleCount: true,
            participantsFemaleCount: true,
            instructorsCount: true,
            recruitsCount: true,
            eloPsychologyCount: true,
            eloSocialAssistanceCount: true,
            eloJuridicoCount: true,
            eloCpcaCount: true,
            eloGraduadoMasterCount: true,
            participantsCharacteristics: true,
            mainPointsObserved: true,
            attentionPoints: true,
            nextSteps: true,
            referencesAndAttachments: true,
            conclusion: true,
            city: true,
            closingDate: true,
            signedAt: true,
            signatureHash: true,
          },
        },
      },
    } as any);
    const localityById = new Map(
      localities.map((locality) => [locality.id, locality]),
    );
    const filteredActivities = activities.filter((activity) =>
      activity.localityId ? aliasByLocalityId.has(activity.localityId) : false,
    );

    const canonicalLocalityIdByActivityId = new Map<string, string>();
    const activitiesByLocalityId = new Map<
      string,
      (typeof filteredActivities)[number][]
    >();
    for (const activity of filteredActivities) {
      const canonicalId = aliasByLocalityId.get(activity.localityId ?? '');
      if (!canonicalId) continue;
      canonicalLocalityIdByActivityId.set(activity.id, canonicalId);
      const list = activitiesByLocalityId.get(canonicalId) ?? [];
      list.push(activity);
      activitiesByLocalityId.set(canonicalId, list);
    }
    const now = Date.now();
    const progressWeightByStatus: Record<ActivityStatus, number> = {
      [ActivityStatus.NOT_STARTED]: 0,
      [ActivityStatus.IN_PROGRESS]: 50,
      [ActivityStatus.DONE]: 100,
      [ActivityStatus.CANCELLED]: 100,
    };
    const isLateActivity = (
      activity: (typeof filteredActivities)[number],
    ): boolean => {
      if (!activity.eventDate) return false;
      if (
        activity.status === ActivityStatus.DONE ||
        activity.status === ActivityStatus.CANCELLED
      ) {
        return false;
      }
      return activity.eventDate.getTime() < now;
    };
    const hasResponsible = (
      activity: (typeof filteredActivities)[number],
    ): boolean =>
      Array.isArray(activity.responsibles) &&
      activity.responsibles.some((entry: any) => Boolean(entry?.userId));
    const hasSignedReport = (
      activity: (typeof filteredActivities)[number],
    ): boolean =>
      Boolean(activity.report?.signedAt && activity.report?.signatureHash);
    const resolveNormalizedActivityClassifier = (
      activity: (typeof filteredActivities)[number],
    ) =>
      `${String(activity.activityType?.name ?? '').trim()} ${String(
        activity.title ?? '',
      ).trim()}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
    const isVisitActivity = (
      activity: (typeof filteredActivities)[number],
    ): boolean => {
      return resolveNormalizedActivityClassifier(activity).includes('visita');
    };
    const isLectureActivity = (
      activity: (typeof filteredActivities)[number],
    ): boolean => {
      return resolveNormalizedActivityClassifier(activity).includes('palestra');
    };
    const isBestPracticeCycleActivity = (
      activity: (typeof filteredActivities)[number],
    ): boolean => {
      const normalizedTypeName = resolveNormalizedActivityClassifier(activity);
      return (
        normalizedTypeName.includes('ciclo') &&
        /boa[s]?\s+pratica[s]?/.test(normalizedTypeName)
      );
    };
    const isFollowUpActivity = (
      activity: (typeof filteredActivities)[number],
    ): boolean => {
      const normalizedTypeName = resolveNormalizedActivityClassifier(activity);
      return normalizedTypeName.includes('acompanh');
    };
    const isMappingActivity = (
      activity: (typeof filteredActivities)[number],
    ): boolean => {
      const normalizedTypeName = resolveNormalizedActivityClassifier(activity);
      return (
        isVisitActivity(activity) ||
        isFollowUpActivity(activity) ||
        normalizedTypeName.includes('mapeamento')
      );
    };
    const isCompletedActivity = (
      activity: (typeof filteredActivities)[number],
    ): boolean => activity.status === ActivityStatus.DONE;
    const resolveFieldActivitySpecialties = (
      activity: (typeof filteredActivities)[number],
    ): Array<'psychology' | 'socialService' | 'doctrine' | 'law'> => {
      const normalizedNames = this.resolveActivitySpecialtyNormalizedNames(
        activity,
        activity.activityType?.name ?? '',
      );
      const keys = new Set<
        'psychology' | 'socialService' | 'doctrine' | 'law'
      >();
      for (const normalized of normalizedNames) {
        if (!normalized) continue;
        if (normalized.includes('psicologia')) {
          keys.add('psychology');
          continue;
        }
        if (normalized.includes('servico social') || normalized === 'sso') {
          keys.add('socialService');
          continue;
        }
        if (normalized.includes('doutrina')) {
          keys.add('doctrine');
          continue;
        }
        if (normalized.includes('direito') || normalized.includes('jurid')) {
          keys.add('law');
        }
      }
      return Array.from(keys);
    };

    const mapNationalActivityDetail = (
      activity: (typeof filteredActivities)[number],
    ) => {
      const canonicalId =
        canonicalLocalityIdByActivityId.get(activity.id) ??
        activity.localityId ??
        '';
      const locality = localityById.get(canonicalId);
      const isLate = isLateActivity(activity);
      const specialties = this.getActivitySpecialties(activity);
      const specialtyNames = specialties.map((entry) => entry.name);
      const primarySpecialty = specialties[0] ?? null;
      return {
        activityId: activity.id,
        scope: activity.scope ?? null,
        title: activity.title ?? 'Atividade',
        localityId: canonicalId,
        localityCode: locality?.code ?? '',
        localityName: locality?.name ?? '',
        specialtyId: primarySpecialty?.id ?? null,
        specialtyName:
          specialtyNames.length > 0 ? specialtyNames.join(' / ') : '',
        specialtyIds: specialties.map((entry) => entry.id),
        specialtyNames,
        activityTypeName: activity.activityType?.name ?? null,
        eventDate: activity.eventDate ?? null,
        createdAt: activity.createdAt,
        status: activity.status,
        reportRequired: activity.reportRequired,
        hasSignedReport: hasSignedReport(activity),
        isLate,
        isUnassigned: !hasResponsible(activity),
      };
    };
    const mapNationalDrilldownDetail = (
      activity: (typeof filteredActivities)[number],
    ) => {
      const canonicalId =
        canonicalLocalityIdByActivityId.get(activity.id) ??
        activity.localityId ??
        '';
      const locality = localityById.get(canonicalId);
      const instructors = activity.report?.instructorsCount ?? 0;
      const recruits = activity.report?.recruitsCount ?? 0;
      const eloPsychology = activity.report?.eloPsychologyCount ?? 0;
      const eloSocialAssistance =
        activity.report?.eloSocialAssistanceCount ?? 0;
      const eloGraduadoMaster = activity.report?.eloGraduadoMasterCount ?? 0;
      const specialties = this.getActivitySpecialties(activity);
      const specialtyNames = specialties.map((entry) => entry.name);
      const primarySpecialty = specialties[0] ?? null;
      return {
        activityId: activity.id,
        scope: activity.scope ?? null,
        title: activity.title ?? 'Atividade',
        localityId: canonicalId,
        localityCode: locality?.code ?? '',
        localityName: locality?.name ?? '',
        specialtyId: primarySpecialty?.id ?? null,
        specialtyName:
          specialtyNames.length > 0 ? specialtyNames.join(' / ') : '',
        specialtyIds: specialties.map((entry) => entry.id),
        specialtyNames,
        activityTypeName: activity.activityType?.name ?? null,
        eventDate: activity.eventDate ?? null,
        status: activity.status,
        hasSignedReport: hasSignedReport(activity),
        instructors,
        recruits,
        eloPsychology,
        eloSocialAssistance,
        elos: eloPsychology + eloSocialAssistance,
        eloGraduadoMaster,
      };
    };

    const perLocality = localities.map((locality) => {
      const localityActivities = activitiesByLocalityId.get(locality.id) ?? [];
      const visitActivities = localityActivities.filter((activity) =>
        isVisitActivity(activity),
      );
      const latestVisitDate = visitActivities
        .map((activity) => activity.eventDate)
        .filter((value): value is Date => value instanceof Date)
        .sort((a, b) => b.getTime() - a.getTime())[0];
      const visitCompleted = visitActivities.some((activity) => {
        if (activity.status === ActivityStatus.DONE) return true;
        if (activity.status === ActivityStatus.CANCELLED) return false;
        if (!activity.eventDate) return false;
        return activity.eventDate.getTime() <= now;
      });
      const late = localityActivities.filter((activity) =>
        isLateActivity(activity),
      ).length;
      const unassigned = localityActivities.filter(
        (activity) => !hasResponsible(activity),
      ).length;
      const progress = localityActivities.length
        ? Math.round(
            localityActivities.reduce(
              (acc, activity) =>
                acc + progressWeightByStatus[activity.status as ActivityStatus],
              0,
            ) / localityActivities.length,
          )
        : 0;

      return {
        localityId: locality.id,
        localityCode: locality.code,
        localityName: locality.name,
        recruitsFemaleCountCurrent: locality.recruitsFemaleCountCurrent ?? 0,
        commanderName: locality.commanderName ?? null,
        individualMeetingDate: locality.individualMeetingDate
          ? locality.individualMeetingDate.toISOString().slice(0, 10)
          : null,
        visitDate: latestVisitDate
          ? latestVisitDate.toISOString().slice(0, 10)
          : null,
        commandName: locality.commandName ?? null,
        notes: locality.notes ?? null,
        progress,
        late,
        blocked: 0,
        unassigned,
        visitCompleted,
      };
    });

    const totalRecruits = localities.reduce(
      (acc, l) => acc + (l.recruitsFemaleCountCurrent ?? 0),
      0,
    );
    const sortByEventDate = (
      a: (typeof filteredActivities)[number],
      b: (typeof filteredActivities)[number],
    ) => {
      const left = (a.eventDate ?? a.createdAt).getTime();
      const right = (b.eventDate ?? b.createdAt).getTime();
      return left - right;
    };
    const sortByMostRecentEvent = (
      a: (typeof filteredActivities)[number],
      b: (typeof filteredActivities)[number],
    ) => {
      const left = (a.eventDate ?? a.createdAt).getTime();
      const right = (b.eventDate ?? b.createdAt).getTime();
      return right - left;
    };
    const lateItems = filteredActivities
      .filter((activity) => isLateActivity(activity))
      .sort(sortByEventDate)
      .map((activity) => mapNationalActivityDetail(activity));
    const unassignedItems = filteredActivities
      .filter((activity) => !hasResponsible(activity))
      .sort(sortByEventDate)
      .map((activity) => mapNationalActivityDetail(activity));
    const isOpenActivity = (
      activity: (typeof filteredActivities)[number],
    ): boolean =>
      activity.status !== ActivityStatus.DONE &&
      activity.status !== ActivityStatus.CANCELLED;
    const riskTasks = filteredActivities
      .filter(
        (activity) =>
          isOpenActivity(activity) &&
          (isLateActivity(activity) || !hasResponsible(activity)),
      )
      .sort(sortByEventDate)
      .slice(0, 10)
      .map((activity) => mapNationalActivityDetail(activity));
    const reportsCount = filteredActivities.filter((activity) =>
      Boolean(activity.report?.id),
    ).length;
    const smifNewsCount = await this.prisma.socialCommunicationArticle.count({
      where: { tags: { has: 'smif' } },
    });
    const visitsCompleted = perLocality.filter(
      (item) => item.visitCompleted,
    ).length;
    const coverageLocalities = perLocality.filter(
      (item) => Number(item.recruitsFemaleCountCurrent ?? 0) > 0,
    ).length;
    const completedActivities = filteredActivities.filter((activity) =>
      isCompletedActivity(activity),
    );
    const completedFieldActivities = completedActivities.filter(
      (activity) => !isVisitActivity(activity),
    );
    const fieldActivitiesBySpecialty = {
      psychology: 0,
      socialService: 0,
      doctrine: 0,
      law: 0,
    };
    for (const activity of completedFieldActivities) {
      const specialtyKeys = resolveFieldActivitySpecialties(activity);
      for (const specialtyKey of specialtyKeys) {
        fieldActivitiesBySpecialty[specialtyKey] += 1;
      }
    }
    const completedReports = completedActivities.filter((activity) =>
      hasSignedReport(activity),
    ).length;
    const completedVisits = completedActivities.filter((activity) =>
      isVisitActivity(activity),
    ).length;
    const completedLecturesActivities = completedActivities.filter((activity) =>
      isLectureActivity(activity),
    );
    const completedBestPracticeCycleActivities = completedActivities.filter(
      (activity) => isBestPracticeCycleActivity(activity),
    );
    const completedMappingActivities = completedActivities.filter((activity) =>
      isMappingActivity(activity),
    );
    const completedReportsDrilldown = completedActivities
      .filter((activity) => hasSignedReport(activity))
      .sort(sortByMostRecentEvent)
      .map((activity) => mapNationalDrilldownDetail(activity));
    const completedVisitsDrilldown = completedActivities
      .filter((activity) => isVisitActivity(activity))
      .sort(sortByMostRecentEvent)
      .map((activity) => mapNationalDrilldownDetail(activity));
    const completedLecturesDrilldown = completedLecturesActivities
      .slice()
      .sort(sortByMostRecentEvent)
      .map((activity) => mapNationalDrilldownDetail(activity));
    const completedBestPracticeCyclesDrilldown =
      completedBestPracticeCycleActivities
        .slice()
        .sort(sortByMostRecentEvent)
        .map((activity) => mapNationalDrilldownDetail(activity));
    const completedMappingsDrilldown = completedMappingActivities
      .slice()
      .sort(sortByMostRecentEvent)
      .map((activity) => mapNationalDrilldownDetail(activity));

    // Calculate participant KPIs from activity reports
    let totalInstructors = 0;
    let totalRecruitsFromReports = 0;
    let totalEloPsychology = 0;
    let totalEloSocialAssistance = 0;
    let totalElos = 0;
    let totalGraduadosMaster = 0;
    for (const activity of completedActivities) {
      if (activity.report) {
        totalInstructors += activity.report.instructorsCount ?? 0;
        totalRecruitsFromReports += activity.report.recruitsCount ?? 0;
        const eloPsychologyCount = activity.report.eloPsychologyCount ?? 0;
        const eloSocialAssistanceCount =
          activity.report.eloSocialAssistanceCount ?? 0;
        totalEloPsychology += eloPsychologyCount;
        totalEloSocialAssistance += eloSocialAssistanceCount;
        totalElos += eloPsychologyCount + eloSocialAssistanceCount;
        totalGraduadosMaster += activity.report.eloGraduadoMasterCount ?? 0;
      }
    }
    const participantsDrilldown = {
      instructors: completedActivities
        .filter((activity) => (activity.report?.instructorsCount ?? 0) > 0)
        .sort(sortByMostRecentEvent)
        .map((activity) => mapNationalDrilldownDetail(activity)),
      recruits: completedActivities
        .filter((activity) => (activity.report?.recruitsCount ?? 0) > 0)
        .sort(sortByMostRecentEvent)
        .map((activity) => mapNationalDrilldownDetail(activity)),
      elos: completedActivities
        .filter((activity) => {
          const eloPsychology = activity.report?.eloPsychologyCount ?? 0;
          const eloSocialAssistance =
            activity.report?.eloSocialAssistanceCount ?? 0;
          return eloPsychology + eloSocialAssistance > 0;
        })
        .sort(sortByMostRecentEvent)
        .map((activity) => mapNationalDrilldownDetail(activity)),
      graduadosMaster: completedActivities
        .filter(
          (activity) => (activity.report?.eloGraduadoMasterCount ?? 0) > 0,
        )
        .sort(sortByMostRecentEvent)
        .map((activity) => mapNationalDrilldownDetail(activity)),
    };
    const completedFieldActivitiesDrilldown = completedFieldActivities
      .slice()
      .sort(sortByMostRecentEvent)
      .map((activity) => mapNationalDrilldownDetail(activity));
    const fieldActivitiesBySpecialtyDrilldown = {
      psychology: [] as ReturnType<typeof mapNationalDrilldownDetail>[],
      socialService: [] as ReturnType<typeof mapNationalDrilldownDetail>[],
      doctrine: [] as ReturnType<typeof mapNationalDrilldownDetail>[],
      law: [] as ReturnType<typeof mapNationalDrilldownDetail>[],
    };
    for (const activity of completedFieldActivities
      .slice()
      .sort(sortByMostRecentEvent)) {
      const detail = mapNationalDrilldownDetail(activity);
      const specialtyKeys = resolveFieldActivitySpecialties(activity);
      for (const specialtyKey of specialtyKeys) {
        fieldActivitiesBySpecialtyDrilldown[specialtyKey].push(detail);
      }
    }
    const taskWhereClauses: Prisma.TaskInstanceWhereInput[] = [];
    if (localityAliasIds.length === 0) {
      taskWhereClauses.push({ localityId: '__none__' });
    } else {
      taskWhereClauses.push({ localityId: { in: localityAliasIds } });
    }
    taskWhereClauses.push({ status: TaskStatus.DONE });
    if (constraints.specialtyId) {
      taskWhereClauses.push({
        OR: [{ specialtyId: null }, { specialtyId: constraints.specialtyId }],
      });
    }
    const completedTasksWhere: Prisma.TaskInstanceWhereInput =
      taskWhereClauses.length === 1
        ? taskWhereClauses[0]
        : { AND: taskWhereClauses };
    const doneTaskInstances = await this.prisma.taskInstance.findMany({
      where: completedTasksWhere,
      select: {
        localityId: true,
        taskTemplateId: true,
        taskTemplate: {
          select: {
            title: true,
            specialty: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });
    const taskCoverageByTemplateId = new Map<string, Set<string>>();
    const taskTemplateMetaByTemplateId = new Map<
      string,
      { title: string; specialtyName: string | null }
    >();
    for (const instance of doneTaskInstances) {
      if (!instance.taskTemplateId) continue;
      const canonicalLocalityId = aliasByLocalityId.get(instance.localityId);
      if (!canonicalLocalityId) continue;
      const coverage =
        taskCoverageByTemplateId.get(instance.taskTemplateId) ??
        new Set<string>();
      coverage.add(canonicalLocalityId);
      taskCoverageByTemplateId.set(instance.taskTemplateId, coverage);
      if (!taskTemplateMetaByTemplateId.has(instance.taskTemplateId)) {
        taskTemplateMetaByTemplateId.set(instance.taskTemplateId, {
          title: String(instance.taskTemplate?.title ?? '').trim(),
          specialtyName: instance.taskTemplate?.specialty?.name ?? null,
        });
      }
    }
    const requiredLocalityCount = localities.length;
    const completedTaskEntries = Array.from(taskCoverageByTemplateId.entries())
      .filter(
        ([, coveredLocalities]) =>
          coveredLocalities.size >= requiredLocalityCount,
      )
      .sort(([leftTemplateId], [rightTemplateId]) => {
        const leftTitle =
          taskTemplateMetaByTemplateId.get(leftTemplateId)?.title ??
          leftTemplateId;
        const rightTitle =
          taskTemplateMetaByTemplateId.get(rightTemplateId)?.title ??
          rightTemplateId;
        return leftTitle.localeCompare(rightTitle, 'pt-BR');
      });
    const completedTasks = completedTaskEntries.length;
    const completedTasksDrilldown = completedTaskEntries.map(
      ([templateId, coveredLocalities]) => {
        const metadata = taskTemplateMetaByTemplateId.get(templateId);
        const title = metadata?.title || 'Tarefa concluída';
        const params = new URLSearchParams();
        params.set('status', TaskStatus.DONE);
        if (metadata?.title) {
          params.set('q', metadata.title);
        }
        return {
          activityId: `task-template-${templateId}`,
          title,
          localityId: '',
          localityCode: '',
          localityName: 'Cobertura nacional',
          specialtyId: null,
          specialtyName: metadata?.specialtyName || 'Tarefa',
          eventDate: null,
          status: TaskStatus.DONE,
          detailLabel: `${coveredLocalities.size}/${requiredLocalityCount} localidades`,
          linkPath: `/tasks?${params.toString()}`,
        };
      },
    );
    const smifCards = await this.getDashboardNationalCardSettings();

    return {
      items: perLocality,
      totals: {
        localities: perLocality.length,
        coverageLocalities,
        late: perLocality.reduce((acc, item) => acc + item.late, 0),
        blocked: perLocality.reduce((acc, item) => acc + item.blocked, 0),
        unassigned: perLocality.reduce((acc, item) => acc + item.unassigned, 0),
        recruitsFemale: totalRecruits,
        reportsProduced: reportsCount,
        smifNewsCount,
        visitsCompleted,
        completedReports,
        completedTasks,
        completedFieldActivities: completedFieldActivities.length,
        completedVisits,
        completedLectures: completedLecturesActivities.length,
        completedBestPracticeCycles:
          completedBestPracticeCycleActivities.length,
        completedMappings: completedMappingActivities.length,
        fieldActivitiesBySpecialty,
        participantsKpis: {
          instructors: totalInstructors,
          recruits: totalRecruitsFromReports,
          eloPsychology: totalEloPsychology,
          eloSocialAssistance: totalEloSocialAssistance,
          eloGraduadoMaster: totalGraduadosMaster,
        },
        participants: {
          instructors: totalInstructors,
          recruits: totalRecruitsFromReports,
          elos: totalElos,
          graduadosMaster: totalGraduadosMaster,
        },
      },
      drilldown: {
        participants: participantsDrilldown,
        completedReports: completedReportsDrilldown,
        completedTasks: completedTasksDrilldown,
        completedFieldActivities: completedFieldActivitiesDrilldown,
        completedVisits: completedVisitsDrilldown,
        completedLectures: completedLecturesDrilldown,
        completedBestPracticeCycles: completedBestPracticeCyclesDrilldown,
        completedMappings: completedMappingsDrilldown,
        fieldActivitiesBySpecialty: fieldActivitiesBySpecialtyDrilldown,
      },
      lateItems,
      unassignedItems,
      riskTasks,
      smifCards,
      executive_hide_pii: user?.executiveHidePii ?? false,
    };
  }

  async updateDashboardNationalCardSetting(
    id: string,
    payload: {
      title?: string;
      description?: string;
      backgroundColor?: string;
      textColor?: string;
    },
    user?: RbacUser,
  ) {
    this.assertDashboardNationalCardManageAccess(user);

    const cardId = String(id ?? '').trim();
    if (!DASHBOARD_NATIONAL_CARD_SETTING_ID_SET.has(cardId)) {
      throwError('VALIDATION_ERROR', {
        field: 'id',
        reason: 'INVALID_SMIF_CARD',
      });
    }

    const defaults = DASHBOARD_NATIONAL_CARD_SETTING_DEFAULTS.find(
      (item) => item.id === cardId,
    );
    if (!defaults) {
      throwError('UNEXPECTED');
    }

    const [existing] = await this.prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        description: string;
        backgroundColor: string;
        textColor: string;
      }>
    >(Prisma.sql`
      SELECT "id", "title", "description", "backgroundColor", "textColor"
      FROM "DashboardNationalCardSetting"
      WHERE "id" = ${cardId}
      LIMIT 1
    `);

    const current = existing ?? defaults;
    const nextTitle =
      payload.title === undefined
        ? current.title
        : this.sanitizeRequiredText(payload.title, 'title');
    const nextDescription =
      payload.description === undefined
        ? current.description
        : this.sanitizeRequiredText(payload.description, 'description');
    const nextBackgroundColor =
      payload.backgroundColor === undefined
        ? this.normalizeHexColor(
            current.backgroundColor,
            defaults.backgroundColor,
          )
        : this.normalizeHexColor(
            payload.backgroundColor,
            defaults.backgroundColor,
          );
    const nextTextColor =
      payload.textColor === undefined
        ? this.normalizeHexColor(current.textColor, defaults.textColor)
        : this.normalizeHexColor(payload.textColor, defaults.textColor);

    const [saved] = await this.prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        description: string;
        backgroundColor: string;
        textColor: string;
      }>
    >(
      existing
        ? Prisma.sql`
            UPDATE "DashboardNationalCardSetting"
            SET
              "title" = ${nextTitle},
              "description" = ${nextDescription},
              "backgroundColor" = ${nextBackgroundColor},
              "textColor" = ${nextTextColor},
              "updatedAt" = NOW()
            WHERE "id" = ${cardId}
            RETURNING "id", "title", "description", "backgroundColor", "textColor"
          `
        : Prisma.sql`
            INSERT INTO "DashboardNationalCardSetting"
              ("id", "title", "description", "backgroundColor", "textColor", "createdAt", "updatedAt")
            VALUES
              (${cardId}, ${nextTitle}, ${nextDescription}, ${nextBackgroundColor}, ${nextTextColor}, NOW(), NOW())
            RETURNING "id", "title", "description", "backgroundColor", "textColor"
          `,
    );

    if (!saved) throwError('UNEXPECTED');

    await this.audit.log({
      userId: user?.id,
      resource: 'dashboard',
      action: 'update_smif_card',
      entityId: cardId,
      diffJson: saved,
    });

    return saved;
  }

  async getDashboardRecruits(user?: RbacUser, localityId?: string) {
    const localityWhere: Prisma.LocalityWhereInput = {};
    const profile = resolveAccessProfile(user);
    const hasNationalRecruitScope = profile.ti || profile.nationalCommission;
    const constraints = this.getScopeConstraints(user);
    if (
      constraints.localityId &&
      localityId &&
      constraints.localityId !== localityId
    ) {
      localityWhere.id = '__none__';
    } else if (!hasNationalRecruitScope && constraints.localityId) {
      localityWhere.id = constraints.localityId;
    } else if (localityId) {
      localityWhere.id = localityId;
    }

    const [localitiesRaw, historyRaw, recruitMembersRaw] =
      await this.prisma.$transaction([
        this.prisma.locality.findMany({
          where: {
            ...localityWhere,
            catalogType: LocalityCatalogType.SMIF,
          },
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            code: true,
            commanderName: true,
            recruitsFemaleCountCurrent: true,
            updatedAt: true,
          },
        }),
        this.prisma.recruitsHistory.findMany({
          where:
            !hasNationalRecruitScope && constraints.localityId
              ? { localityId: constraints.localityId }
              : undefined,
          orderBy: { date: 'asc' },
        }),
        this.prisma.recruitFemale.findMany({
          where:
            !hasNationalRecruitScope && constraints.localityId
              ? { localityId: constraints.localityId }
              : undefined,
          select: {
            id: true,
            localityId: true,
            name: true,
            status: true,
            dismissalReason: true,
            dismissedAt: true,
            destinationLocalityId: true,
            designatedAt: true,
            destinationLocality: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
          orderBy: [{ name: 'asc' }],
        }),
      ]);
    const history = historyRaw as Array<{
      localityId: string;
      date: Date;
      recruitsFemaleCount: number;
      turnoverCount: number;
      dismissalReason?: string | null;
      createdAt: Date;
    }>;
    const localityGroups = groupTargetLocalities(localitiesRaw);
    const localities = localityGroups.map((group) => group.canonical);
    const { aliasByLocalityId } = createTargetLocalityAliasMap(localityGroups);
    const recruitMembers = recruitMembersRaw.filter((item) =>
      aliasByLocalityId.has(item.localityId),
    );
    const filteredHistory = history.filter((entry) =>
      aliasByLocalityId.has(entry.localityId),
    );
    const normalizedHistoryMap = new Map<
      string,
      {
        localityId: string;
        date: string;
        value: number;
        turnoverCount: number;
        dismissalReason: string | null;
        createdAt: string;
      }
    >();
    for (const entry of filteredHistory) {
      const canonicalId = aliasByLocalityId.get(entry.localityId);
      if (!canonicalId) continue;
      const dateKey = entry.date.toISOString().slice(0, 10);
      const key = `${canonicalId}:${dateKey}`;
      const current = normalizedHistoryMap.get(key);
      const entryCreatedAt = entry.createdAt.toISOString();
      if (
        !current ||
        entryCreatedAt > current.createdAt ||
        (entryCreatedAt === current.createdAt &&
          entry.recruitsFemaleCount > current.value)
      ) {
        normalizedHistoryMap.set(key, {
          localityId: canonicalId,
          date: dateKey,
          value: entry.recruitsFemaleCount,
          turnoverCount: entry.turnoverCount ?? 0,
          dismissalReason: entry.dismissalReason ?? null,
          createdAt: entryCreatedAt,
        });
      }
    }
    const normalizedHistory = Array.from(normalizedHistoryMap.values()).sort(
      (a, b) => a.date.localeCompare(b.date),
    );

    const currentPerLocality = localities.map((loc) => {
      const locMembers = recruitMembers.filter(
        (member) => aliasByLocalityId.get(member.localityId) === loc.id,
      );
      const activeCount = locMembers.filter(
        (member) =>
          member.status === 'RECRUITMENT_TO_START' ||
          member.status === 'RECRUITMENT_STARTED',
      ).length;
      return {
        localityId: loc.id,
        localityName: loc.name,
        code: loc.code,
        commanderName: loc.commanderName ?? null,
        recruitsFemaleCountCurrent: activeCount,
        recruitsByStatus: {
          toStart: locMembers.filter(
            (member) => member.status === 'RECRUITMENT_TO_START',
          ).length,
          started: locMembers.filter(
            (member) => member.status === 'RECRUITMENT_STARTED',
          ).length,
          dismissed: locMembers.filter(
            (member) => member.status === 'DISMISSED',
          ).length,
          assignedToOm: locMembers.filter(
            (member) => member.status === 'ASSIGNED_TO_OM',
          ).length,
        },
      };
    });

    const aggregateByMonth: { month: string; value: number }[] = [];
    const monthMap = new Map<string, number>();
    for (const entry of normalizedHistory) {
      const monthKey = entry.date.slice(0, 7);
      monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + entry.value);
    }
    for (const [month, value] of Array.from(monthMap.entries()).sort()) {
      aggregateByMonth.push({ month, value });
    }

    const byLocalityMap = new Map<
      string,
      Array<{
        date: string;
        value: number;
        turnoverCount: number;
        dismissalReason: string | null;
      }>
    >();
    for (const entry of normalizedHistory) {
      const key = entry.localityId;
      if (!byLocalityMap.has(key)) byLocalityMap.set(key, []);
      byLocalityMap.get(key)!.push({
        date: entry.date,
        value: entry.value,
        turnoverCount: entry.turnoverCount,
        dismissalReason: entry.dismissalReason,
      });
    }
    const localityById = new Map(localities.map((l) => [l.id, l]));
    const byLocality = Array.from(byLocalityMap.entries()).map(
      ([localityId, series]) => ({
        localityId,
        localityName: localityById.get(localityId)?.name ?? localityId,
        code: localityById.get(localityId)?.code ?? '',
        series,
      }),
    );
    const historyLog = normalizedHistory
      .map((entry) => ({
        localityId: entry.localityId,
        localityName:
          localityById.get(entry.localityId)?.name ?? entry.localityId,
        code: localityById.get(entry.localityId)?.code ?? '',
        date: entry.date,
        recruitsFemaleCount: entry.value,
        turnoverCount: entry.turnoverCount,
        dismissalReason: entry.dismissalReason,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
    const dismissedRecruitsLog = recruitMembers
      .filter((member) => member.status === 'DISMISSED')
      .map((member) => {
        const canonicalId = aliasByLocalityId.get(member.localityId);
        return {
          recruitId: member.id,
          recruitName: member.name,
          localityId: canonicalId ?? member.localityId,
          localityName:
            localityById.get(canonicalId ?? member.localityId)?.name ??
            member.localityId,
          code: localityById.get(canonicalId ?? member.localityId)?.code ?? '',
          dismissalReason: member.dismissalReason ?? null,
          dismissedAt: member.dismissedAt?.toISOString() ?? null,
        };
      })
      .sort((a, b) =>
        String(b.dismissedAt ?? '').localeCompare(String(a.dismissedAt ?? '')),
      );

    return {
      currentPerLocality,
      aggregateByMonth,
      byLocality,
      historyLog,
      dismissedRecruitsLog,
    };
  }

  async getDashboardExecutive(
    params: {
      from?: string;
      to?: string;
      phaseId?: string;
      threshold?: string;
      command?: string;
      localityId?: string;
      scope?: string;
    },
    user?: RbacUser,
  ) {
    const emptyResponse = {
      summary: {
        totalActivities: 0,
        completedActivities: 0,
        completionPercent: 0,
        lateActivities: 0,
        unassignedActivities: 0,
        reportPending: 0,
        reportApproved: 0,
        reportTotal: 0,
      },
      status: {
        items: [],
      },
      progress: {
        overall: 0,
        byLocality: [],
      },
      localityAboveThreshold: {
        threshold: 0,
        count: 0,
        total: 0,
        items: [],
      },
      specialties: {
        items: [],
      },
      late: {
        total: 0,
        trend: [],
        items: [],
      },
      unassigned: {
        total: 0,
        byLocality: [],
        items: [],
      },
      reportsCompliance: {
        approved: 0,
        pending: 0,
        total: 0,
        completedItems: [],
        pendingItems: [],
      },
      kpiDetails: {
        completedActivities: [],
        visitedCities: [],
        reportsApproved: [],
        participantsInActivities: [],
      },
      risk: {
        top10: [],
      },
    };

    const scopeFilter: ActivityScope =
      String(params.scope ?? '').toUpperCase() === 'CIPAVD'
        ? ActivityScope.CIPAVD
        : ActivityScope.SMIF;
    const localityCatalogType =
      scopeFilter === ActivityScope.CIPAVD
        ? LocalityCatalogType.CIPAVD
        : LocalityCatalogType.SMIF;
    const allowedLocalityIds =
      scopeFilter === ActivityScope.SMIF
        ? await this.getTargetLocalityIds()
        : [];
    if (scopeFilter === ActivityScope.SMIF && allowedLocalityIds.length === 0) {
      return user?.executiveHidePii
        ? sanitizeForExecutive(emptyResponse)
        : emptyResponse;
    }

    const from = params.from ? new Date(params.from) : null;
    const to = params.to ? new Date(params.to) : null;
    const thresholdRaw = Number(params.threshold ?? 70);
    const threshold = Number.isFinite(thresholdRaw) ? thresholdRaw : 70;

    const localityWhere: Prisma.LocalityWhereInput = {
      ...(scopeFilter === ActivityScope.SMIF
        ? { id: { in: allowedLocalityIds } }
        : {}),
    };
    if (params.command) {
      localityWhere.commandName = params.command;
    }

    const constraints = this.getScopeConstraints(user);
    if (
      constraints.localityId &&
      params.localityId &&
      constraints.localityId !== params.localityId
    ) {
      localityWhere.id = '__none__';
    } else if (constraints.localityId) {
      localityWhere.id = constraints.localityId;
    } else if (params.localityId) {
      localityWhere.id = params.localityId;
    }

    const localitiesRaw = await this.prisma.locality.findMany({
      where: { ...localityWhere, catalogType: localityCatalogType },
      orderBy: { name: 'asc' },
    });

    const localityGroups =
      scopeFilter === ActivityScope.SMIF
        ? groupTargetLocalities(localitiesRaw)
        : [];
    const localities =
      scopeFilter === ActivityScope.SMIF
        ? localityGroups.map((group) => group.canonical)
        : localitiesRaw;
    const aliasByLocalityId =
      scopeFilter === ActivityScope.SMIF
        ? createTargetLocalityAliasMap(localityGroups).aliasByLocalityId
        : new Map<string, string>(
            localitiesRaw.map((locality) => [
              String(locality.id),
              String(locality.id),
            ]),
          );
    const localityIds = Array.from(aliasByLocalityId.keys());
    if (!localityIds.length) {
      return user?.executiveHidePii
        ? sanitizeForExecutive(emptyResponse)
        : emptyResponse;
    }

    const activityDateRangeFilter: Prisma.ActivityWhereInput | null =
      from || to
        ? {
            OR: [
              {
                eventDate: {
                  ...(from ? { gte: from } : {}),
                  ...(to ? { lte: to } : {}),
                },
              },
              {
                eventDate: null,
                createdAt: {
                  ...(from ? { gte: from } : {}),
                  ...(to ? { lte: to } : {}),
                },
              },
            ],
          }
        : null;

    const activities: any[] = await this.prisma.activity.findMany({
      where: {
        localityId: { in: localityIds },
        scope: scopeFilter,
        ...(activityDateRangeFilter ?? {}),
      },
      include: {
        locality: {
          select: {
            id: true,
            code: true,
            name: true,
            commandName: true,
          },
        },
        specialty: {
          select: {
            id: true,
            name: true,
          },
        },
        specialties: {
          select: {
            specialtyId: true,
            specialty: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        activityType: {
          select: {
            id: true,
            name: true,
          },
        },
        responsibles: {
          select: {
            userId: true,
          },
        },
        report: {
          select: {
            id: true,
            date: true,
            location: true,
            responsible: true,
            missionSupport: true,
            introduction: true,
            missionObjectives: true,
            executionSchedule: true,
            activitiesPerformed: true,
            participantsCount: true,
            participantsMaleCount: true,
            participantsFemaleCount: true,
            instructorsCount: true,
            recruitsCount: true,
            eloPsychologyCount: true,
            eloSocialAssistanceCount: true,
            eloJuridicoCount: true,
            eloCpcaCount: true,
            eloGraduadoMasterCount: true,
            participantsCharacteristics: true,
            mainPointsObserved: true,
            attentionPoints: true,
            nextSteps: true,
            referencesAndAttachments: true,
            conclusion: true,
            city: true,
            closingDate: true,
            signedAt: true,
            signatureHash: true,
          },
        },
      },
      orderBy: [{ eventDate: 'asc' }, { createdAt: 'asc' }],
    } as any);
    const filteredActivities = activities.filter((activity) =>
      activity.localityId ? aliasByLocalityId.has(activity.localityId) : false,
    );

    const statusOrder = [
      ActivityStatus.NOT_STARTED,
      ActivityStatus.IN_PROGRESS,
      ActivityStatus.DONE,
      ActivityStatus.CANCELLED,
    ] as const;
    const progressWeightByStatus: Record<ActivityStatus, number> = {
      [ActivityStatus.NOT_STARTED]: 0,
      [ActivityStatus.IN_PROGRESS]: 50,
      [ActivityStatus.DONE]: 100,
      [ActivityStatus.CANCELLED]: 100,
    };

    const localityById = new Map(
      localities.map((locality) => [locality.id, locality]),
    );
    const canonicalLocalityIdByActivityId = new Map<string, string>();
    const activitiesByLocalityId = new Map<
      string,
      (typeof filteredActivities)[number][]
    >();
    for (const activity of filteredActivities) {
      const canonicalId = aliasByLocalityId.get(activity.localityId ?? '');
      if (!canonicalId) continue;
      canonicalLocalityIdByActivityId.set(activity.id, canonicalId);
      const list = activitiesByLocalityId.get(canonicalId) ?? [];
      list.push(activity);
      activitiesByLocalityId.set(canonicalId, list);
    }
    const dayMs = 1000 * 60 * 60 * 24;
    const now = Date.now();
    const isLate = (activity: (typeof filteredActivities)[number]): boolean => {
      if (!activity.eventDate) return false;
      if (
        activity.status === ActivityStatus.DONE ||
        activity.status === ActivityStatus.CANCELLED
      ) {
        return false;
      }
      return activity.eventDate.getTime() < now;
    };
    const hasResponsible = (
      activity: (typeof filteredActivities)[number],
    ): boolean =>
      Array.isArray(activity.responsibles) &&
      activity.responsibles.some((entry: any) => Boolean(entry?.userId));
    const hasSignedReport = (
      activity: (typeof filteredActivities)[number],
    ): boolean =>
      Boolean(activity.report?.signedAt && activity.report?.signatureHash);
    const isVisitActivity = (
      activity: (typeof filteredActivities)[number],
    ): boolean => {
      const typeName = String(activity.activityType?.name ?? '')
        .trim()
        .toLowerCase();
      return typeName.includes('visita');
    };

    const mapExecutiveActivityItem = (
      activity: (typeof filteredActivities)[number],
    ) => {
      const canonicalId =
        canonicalLocalityIdByActivityId.get(activity.id) ??
        activity.localityId ??
        '';
      const locality = localityById.get(canonicalId);
      const late = isLate(activity);
      const specialties = this.getActivitySpecialties(activity);
      const specialtyNames = specialties.map((entry) => entry.name);
      const primarySpecialty = specialties[0] ?? null;
      return {
        activityId: activity.id,
        scope: activity.scope ?? null,
        title: activity.title ?? 'Atividade',
        activityTypeName: activity.activityType?.name ?? null,
        specialtyId: primarySpecialty?.id ?? null,
        specialtyName:
          specialtyNames.length > 0 ? specialtyNames.join(' / ') : '',
        specialtyIds: specialties.map((entry) => entry.id),
        specialtyNames,
        localityId: canonicalId,
        localityCode: locality?.code ?? '',
        localityName: locality?.name ?? '',
        commandName: locality?.commandName ?? '',
        eventDate: activity.eventDate,
        createdAt: activity.createdAt,
        status: activity.status,
        isVisit: isVisitActivity(activity),
        reportRequired: activity.reportRequired,
        hasSignedReport: hasSignedReport(activity),
        isLate: late,
        daysLate: late
          ? Math.max(
              1,
              Math.ceil((now - (activity.eventDate?.getTime() ?? now)) / dayMs),
            )
          : 0,
        isUnassigned: !hasResponsible(activity),
      };
    };

    const activityItems = filteredActivities.map((activity) =>
      mapExecutiveActivityItem(activity),
    );
    const sortByMostRecentActivity = (a: any, b: any) => {
      const left = new Date(a.eventDate ?? a.createdAt ?? 0).getTime();
      const right = new Date(b.eventDate ?? b.createdAt ?? 0).getTime();
      return right - left;
    };
    const totalActivities = activityItems.length;
    const completedActivities = activityItems.filter(
      (activity) =>
        activity.status === ActivityStatus.DONE ||
        activity.status === ActivityStatus.CANCELLED,
    ).length;
    const completionPercent = totalActivities
      ? Math.round((completedActivities / totalActivities) * 100)
      : 0;
    const overallProgress = totalActivities
      ? Math.round(
          activityItems.reduce(
            (acc, activity) =>
              acc + progressWeightByStatus[activity.status as ActivityStatus],
            0,
          ) / totalActivities,
        )
      : 0;

    const progressByLocality = localities
      .map((locality) => {
        const localityActivities =
          activitiesByLocalityId.get(locality.id) ?? [];
        const done = localityActivities.filter(
          (activity) =>
            activity.status === ActivityStatus.DONE ||
            activity.status === ActivityStatus.CANCELLED,
        ).length;
        const late = localityActivities.filter((activity) =>
          isLate(activity),
        ).length;
        const unassigned = localityActivities.filter(
          (activity) => !hasResponsible(activity),
        ).length;
        const reportPending = localityActivities.filter(
          (activity) =>
            activity.reportRequired &&
            activity.status === ActivityStatus.DONE &&
            !hasSignedReport(activity),
        ).length;
        const avg = localityActivities.length
          ? localityActivities.reduce(
              (acc, activity) =>
                acc + progressWeightByStatus[activity.status as ActivityStatus],
              0,
            ) / localityActivities.length
          : 0;
        return {
          localityId: locality.id,
          localityCode: locality.code,
          localityName: locality.name,
          commandName: locality.commandName ?? '',
          progress: Math.round(avg),
          activitiesCount: localityActivities.length,
          done,
          late,
          unassigned,
          reportPending,
        };
      })
      .sort((a, b) => b.progress - a.progress);

    const localitiesAboveThreshold = progressByLocality.filter(
      (entry) => entry.progress >= threshold,
    );

    const lateActivities = filteredActivities.filter((activity) =>
      isLate(activity),
    );
    const lateItems = lateActivities
      .slice()
      .sort((a, b) => {
        const left = a.eventDate?.getTime() ?? 0;
        const right = b.eventDate?.getTime() ?? 0;
        return left - right;
      })
      .map((activity) => mapExecutiveActivityItem(activity));

    const weeklyTrend: Array<{
      week: string;
      late: number;
      localities: Array<{
        localityId: string;
        localityCode: string;
        localityName: string;
        count: number;
      }>;
    }> = [];
    for (let i = 7; i >= 0; i -= 1) {
      const start = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      const weekItems = filteredActivities.filter(
        (activity) =>
          activity.eventDate &&
          activity.eventDate >= start &&
          activity.eventDate < end &&
          isLate(activity),
      );
      const byLocality = new Map<
        string,
        {
          localityId: string;
          localityCode: string;
          localityName: string;
          count: number;
        }
      >();
      for (const activity of weekItems) {
        const canonicalId =
          canonicalLocalityIdByActivityId.get(activity.id) ??
          activity.localityId ??
          '';
        const locality = localityById.get(canonicalId);
        const key = locality?.id ?? canonicalId;
        const current = byLocality.get(key);
        if (current) {
          current.count += 1;
          continue;
        }
        byLocality.set(key, {
          localityId: key,
          localityCode: locality?.code ?? '',
          localityName: locality?.name ?? '',
          count: 1,
        });
      }
      weeklyTrend.push({
        week: start.toISOString().slice(0, 10),
        late: weekItems.length,
        localities: Array.from(byLocality.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 6),
      });
    }

    const unassigned = filteredActivities.filter(
      (activity) => !hasResponsible(activity),
    );
    const unassignedItems = unassigned
      .slice()
      .sort((a, b) => {
        const left = a.eventDate?.getTime() ?? 0;
        const right = b.eventDate?.getTime() ?? 0;
        return left - right;
      })
      .map((activity) => mapExecutiveActivityItem(activity));
    const unassignedByLocality = new Map<
      string,
      {
        localityId: string;
        localityCode: string;
        localityName: string;
        commandName: string;
        count: number;
      }
    >();
    for (const activity of unassigned) {
      const canonicalId =
        canonicalLocalityIdByActivityId.get(activity.id) ??
        activity.localityId ??
        '';
      const locality = localityById.get(canonicalId);
      const localityKey = locality?.id ?? canonicalId;
      const current = unassignedByLocality.get(localityKey);
      if (current) {
        current.count += 1;
      } else {
        unassignedByLocality.set(localityKey, {
          localityId: localityKey,
          localityCode: locality?.code ?? '',
          localityName: locality?.name ?? '',
          commandName: locality?.commandName ?? 'Sem comando',
          count: 1,
        });
      }
    }

    const reportRequiredCompletedActivities = filteredActivities.filter(
      (activity) =>
        activity.reportRequired &&
        (activity.status === ActivityStatus.DONE ||
          activity.status === ActivityStatus.CANCELLED),
    );
    const signedReportActivities = filteredActivities.filter((activity) =>
      hasSignedReport(activity),
    );
    const complianceApproved = signedReportActivities.length;
    const reportPendingActivities = reportRequiredCompletedActivities.filter(
      (activity) => !hasSignedReport(activity),
    );
    const compliancePending = reportPendingActivities.length;
    const complianceTotal = complianceApproved + compliancePending;
    const reportPendingItems = reportPendingActivities.map((activity) =>
      mapExecutiveActivityItem(activity),
    );
    const completedActivitiesWithSavedReport = filteredActivities.filter(
      (activity) =>
        activity.status === ActivityStatus.DONE && Boolean(activity.report?.id),
    );
    const participantsInCompletedActivities =
      completedActivitiesWithSavedReport.reduce(
        (acc, activity) =>
          acc + Number(activity.report?.participantsCount ?? 0),
        0,
      );
    const visitedCities = new Set(
      filteredActivities
        .filter(
          (activity) =>
            activity.status === ActivityStatus.DONE &&
            isVisitActivity(activity),
        )
        .map(
          (activity) =>
            canonicalLocalityIdByActivityId.get(activity.id) ??
            activity.localityId ??
            '',
        )
        .filter(Boolean),
    ).size;
    const completedActivitiesItems = filteredActivities
      .filter((activity) => activity.status === ActivityStatus.DONE)
      .map((activity) => mapExecutiveActivityItem(activity))
      .sort(sortByMostRecentActivity);
    const visitedCitiesMap = new Map<
      string,
      {
        localityId: string;
        localityCode: string;
        localityName: string;
        commandName: string;
        visitActivities: number;
        lastVisitDate: Date | null;
      }
    >();
    for (const activity of filteredActivities) {
      if (
        activity.status !== ActivityStatus.DONE ||
        !isVisitActivity(activity)
      ) {
        continue;
      }
      const canonicalId =
        canonicalLocalityIdByActivityId.get(activity.id) ??
        activity.localityId ??
        '';
      if (!canonicalId) continue;
      const locality = localityById.get(canonicalId);
      const current = visitedCitiesMap.get(canonicalId);
      const currentEventDate = activity.eventDate ?? activity.createdAt;
      if (!current) {
        visitedCitiesMap.set(canonicalId, {
          localityId: canonicalId,
          localityCode: locality?.code ?? '',
          localityName: locality?.name ?? '',
          commandName: locality?.commandName ?? '',
          visitActivities: 1,
          lastVisitDate: currentEventDate ?? null,
        });
        continue;
      }
      current.visitActivities += 1;
      if (
        currentEventDate &&
        (!current.lastVisitDate ||
          currentEventDate.getTime() > current.lastVisitDate.getTime())
      ) {
        current.lastVisitDate = currentEventDate;
      }
    }
    const visitedCitiesItems = Array.from(visitedCitiesMap.values()).sort(
      (a, b) => {
        if (b.visitActivities !== a.visitActivities) {
          return b.visitActivities - a.visitActivities;
        }
        return (
          new Date(b.lastVisitDate ?? 0).getTime() -
          new Date(a.lastVisitDate ?? 0).getTime()
        );
      },
    );
    const participantsActivitiesItems = completedActivitiesWithSavedReport
      .filter((activity) => Number(activity.report?.participantsCount ?? 0) > 0)
      .map((activity) => {
        const baseItem = mapExecutiveActivityItem(activity);
        return {
          ...baseItem,
          report: activity.report
            ? {
                id: activity.report.id,
                signedAt: activity.report.signedAt,
                date: activity.report.date,
                location: activity.report.location,
                responsible: activity.report.responsible,
                missionSupport: activity.report.missionSupport,
                introduction: activity.report.introduction,
                missionObjectives: activity.report.missionObjectives,
                executionSchedule: activity.report.executionSchedule,
                activitiesPerformed: activity.report.activitiesPerformed,
                participantsCount: activity.report.participantsCount,
                participantsMaleCount: activity.report.participantsMaleCount,
                participantsFemaleCount:
                  activity.report.participantsFemaleCount,
                instructorsCount: activity.report.instructorsCount,
                recruitsCount: activity.report.recruitsCount,
                eloPsychologyCount: activity.report.eloPsychologyCount,
                eloSocialAssistanceCount:
                  activity.report.eloSocialAssistanceCount,
                eloJuridicoCount: activity.report.eloJuridicoCount,
                eloCpcaCount: activity.report.eloCpcaCount,
                eloGraduadoMasterCount: activity.report.eloGraduadoMasterCount,
                participantsCharacteristics:
                  activity.report.participantsCharacteristics,
                mainPointsObserved: activity.report.mainPointsObserved,
                attentionPoints: activity.report.attentionPoints,
                nextSteps: activity.report.nextSteps,
                referencesAndAttachments:
                  activity.report.referencesAndAttachments,
                conclusion: activity.report.conclusion,
                city: activity.report.city,
                closingDate: activity.report.closingDate,
              }
            : null,
        };
      })
      .sort(sortByMostRecentActivity);
    const reportCompletedItems = signedReportActivities
      .map((activity) => {
        const baseItem = mapExecutiveActivityItem(activity);
        return {
          ...baseItem,
          report: activity.report
            ? {
                id: activity.report.id,
                signedAt: activity.report.signedAt,
                date: activity.report.date,
                location: activity.report.location,
                responsible: activity.report.responsible,
                missionSupport: activity.report.missionSupport,
                introduction: activity.report.introduction,
                missionObjectives: activity.report.missionObjectives,
                executionSchedule: activity.report.executionSchedule,
                activitiesPerformed: activity.report.activitiesPerformed,
                participantsCount: activity.report.participantsCount,
                participantsMaleCount: activity.report.participantsMaleCount,
                participantsFemaleCount:
                  activity.report.participantsFemaleCount,
                instructorsCount: activity.report.instructorsCount,
                recruitsCount: activity.report.recruitsCount,
                eloPsychologyCount: activity.report.eloPsychologyCount,
                eloSocialAssistanceCount:
                  activity.report.eloSocialAssistanceCount,
                eloJuridicoCount: activity.report.eloJuridicoCount,
                eloCpcaCount: activity.report.eloCpcaCount,
                eloGraduadoMasterCount: activity.report.eloGraduadoMasterCount,
                participantsCharacteristics:
                  activity.report.participantsCharacteristics,
                mainPointsObserved: activity.report.mainPointsObserved,
                attentionPoints: activity.report.attentionPoints,
                nextSteps: activity.report.nextSteps,
                referencesAndAttachments:
                  activity.report.referencesAndAttachments,
                conclusion: activity.report.conclusion,
                city: activity.report.city,
                closingDate: activity.report.closingDate,
              }
            : null,
        };
      })
      .sort((a, b) => {
        const left = new Date(a.report?.signedAt ?? a.createdAt ?? 0).getTime();
        const right = new Date(
          b.report?.signedAt ?? b.createdAt ?? 0,
        ).getTime();
        return right - left;
      });

    // Get specialty IDs - search more broadly to ensure we find them
    const psicologiaSpecialty = await this.prisma.specialty.findFirst({
      where: {
        OR: [
          { name: { equals: 'Psicologia', mode: 'insensitive' } },
          { name: { contains: 'Psicologia', mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true },
    });
    const commissionSpecialty = await this.prisma.specialty.findFirst({
      where: {
        OR: [
          { name: { equals: 'Comissão CIPAVD', mode: 'insensitive' } },
          { name: { contains: 'Comissão CIPAVD', mode: 'insensitive' } },
          { name: { contains: 'Comissao CIPAVD', mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true },
    });
    const psicologiaSpecialtyId = psicologiaSpecialty?.id ?? null;
    const commissionSpecialtyId = commissionSpecialty?.id ?? null;

    const normalizeSpecialtyBucketName = (value: string) =>
      String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

    const specialtiesMap = new Map<
      string,
      { specialtyId: string | null; specialtyName: string; count: number }
    >();

    for (const activity of filteredActivities) {
      const activitySpecialties = this.getActivitySpecialties(activity);
      const normalizedEntries =
        activitySpecialties.length > 0
          ? activitySpecialties
          : [{ id: null, name: 'Comissão CIPAVD' }];
      const processedKeys = new Set<string>();

      for (const entry of normalizedEntries) {
        const specialtyId = entry.id ?? null;
        const specialtyName = String(entry.name ?? '').trim();
        const normalizedName = normalizeSpecialtyBucketName(specialtyName);
        const hasSpecialtyName = Boolean(normalizedName);

        let key: string;
        let displayName: string;

        if (
          specialtyId === psicologiaSpecialtyId ||
          (normalizedName && normalizedName.includes('psicologia'))
        ) {
          key = '__psicologia__';
          displayName = 'Psicologia';
        } else if (
          specialtyId === commissionSpecialtyId ||
          (normalizedName && normalizedName.includes('comissao cipavd'))
        ) {
          key = '__commission__';
          displayName = 'Comissão CIPAVD';
        } else if (!specialtyId || !hasSpecialtyName || !normalizedName) {
          key = '__commission__';
          displayName = 'Comissão CIPAVD';
        } else {
          key = specialtyId ?? (normalizedName || '__unknown__');
          displayName = specialtyName || 'Sem especialidade';
        }

        if (processedKeys.has(key)) continue;
        processedKeys.add(key);

        const current = specialtiesMap.get(key);
        if (current) {
          current.count += 1;
        } else {
          const finalSpecialtyId =
            key === '__psicologia__'
              ? psicologiaSpecialtyId
              : key === '__commission__'
                ? commissionSpecialtyId
                : specialtyId;
          specialtiesMap.set(key, {
            specialtyId: finalSpecialtyId,
            specialtyName: displayName,
            count: 1,
          });
        }
      }
    }

    const riskScores = localities.map((locality) => {
      const localityActivities = activitiesByLocalityId.get(locality.id) ?? [];
      const late = localityActivities.filter((activity) =>
        isLate(activity),
      ).length;
      const unassignedCount = localityActivities.filter(
        (activity) => !hasResponsible(activity),
      ).length;
      const reportPending = localityActivities.filter(
        (activity) =>
          activity.reportRequired &&
          activity.status === ActivityStatus.DONE &&
          !hasSignedReport(activity),
      ).length;
      const score = late * 2 + unassignedCount + reportPending * 2;
      return {
        localityId: locality.id,
        localityCode: locality.code,
        commandName: locality.commandName ?? '',
        score,
        breakdown: {
          late,
          unassigned: unassignedCount,
          reportPending,
        },
      };
    });

    const statusItems = statusOrder.map((status) => ({
      status,
      count: activityItems.filter((item) => item.status === status).length,
    }));

    const response = {
      summary: {
        totalActivities,
        completedActivities,
        completionPercent,
        visitedCities,
        participantsInActivities: participantsInCompletedActivities,
        lateActivities: lateItems.length,
        unassignedActivities: unassignedItems.length,
        reportPending: compliancePending,
        reportApproved: complianceApproved,
        reportTotal: complianceTotal,
      },
      status: {
        items: statusItems,
      },
      progress: {
        overall: overallProgress,
        byLocality: progressByLocality,
      },
      localityAboveThreshold: {
        threshold,
        count: localitiesAboveThreshold.length,
        total: progressByLocality.length,
        items: localitiesAboveThreshold.sort((a, b) => b.progress - a.progress),
      },
      specialties: {
        items: Array.from(specialtiesMap.values()).sort(
          (a, b) => b.count - a.count,
        ),
      },
      late: {
        total: lateItems.length,
        trend: weeklyTrend,
        items: lateItems,
      },
      unassigned: {
        total: unassigned.length,
        byLocality: Array.from(unassignedByLocality.values()).sort(
          (a, b) => b.count - a.count,
        ),
        items: unassignedItems,
      },
      reportsCompliance: {
        approved: complianceApproved,
        pending: compliancePending,
        total: complianceTotal,
        completedItems: reportCompletedItems,
        pendingItems: reportPendingItems,
      },
      kpiDetails: {
        completedActivities: completedActivitiesItems,
        visitedCities: visitedCitiesItems,
        reportsApproved: reportCompletedItems,
        participantsInActivities: participantsActivitiesItems,
      },
      risk: {
        top10: riskScores.sort((a, b) => b.score - a.score).slice(0, 10),
      },
    };

    return user?.executiveHidePii ? sanitizeForExecutive(response) : response;
  }

  async debugPsicologiaActivities(
    params: {
      from?: string;
      to?: string;
    },
    user?: RbacUser,
  ) {
    const allowedLocalityIds = await this.getTargetLocalityIds();
    if (allowedLocalityIds.length === 0) {
      return { count: 0, activities: [] };
    }

    const from = params.from ? new Date(params.from) : null;
    const to = params.to ? new Date(params.to) : null;

    const localitiesRaw = await this.prisma.locality.findMany({
      where: {
        id: { in: allowedLocalityIds },
        catalogType: LocalityCatalogType.SMIF,
      },
      orderBy: { name: 'asc' },
    });

    const localityGroups = groupTargetLocalities(localitiesRaw);
    const { aliasByLocalityId } = createTargetLocalityAliasMap(localityGroups);
    const localityIds = Array.from(aliasByLocalityId.keys());

    const activityDateRangeFilter: Prisma.ActivityWhereInput | null =
      from || to
        ? {
            OR: [
              {
                eventDate: {
                  ...(from ? { gte: from } : {}),
                  ...(to ? { lte: to } : {}),
                },
              },
              {
                eventDate: null,
                createdAt: {
                  ...(from ? { gte: from } : {}),
                  ...(to ? { lte: to } : {}),
                },
              },
            ],
          }
        : null;

    const activities: any[] = await this.prisma.activity.findMany({
      where: {
        localityId: { in: localityIds },
        ...(activityDateRangeFilter ?? {}),
      },
      include: {
        specialty: {
          select: {
            id: true,
            name: true,
          },
        },
        specialties: {
          select: {
            specialtyId: true,
            specialty: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [{ eventDate: 'asc' }, { createdAt: 'asc' }],
    } as any);

    const filteredActivities = activities.filter((activity) =>
      activity.localityId ? aliasByLocalityId.has(activity.localityId) : false,
    );

    const psicologiaActivities = filteredActivities.filter((activity) => {
      const normalizedNames =
        this.resolveActivitySpecialtyNormalizedNames(activity);
      return normalizedNames.some(
        (name) =>
          name.includes('psicologia') ||
          this.getActivitySpecialties(activity).some(
            (entry) => entry.id === 'cmlpet4hv004kzpvci51ktsd2',
          ),
      );
    });

    return {
      count: psicologiaActivities.length,
      totalActivities: filteredActivities.length,
      activities: psicologiaActivities.map((a) => ({
        id: a.id,
        title: a.title,
        specialtyId: a.specialtyId,
        specialtyName: a.specialty?.name || null,
        specialtyIds: this.getActivitySpecialties(a).map((entry) => entry.id),
        specialtyNames: this.getActivitySpecialties(a).map(
          (entry) => entry.name,
        ),
        localityId: a.localityId,
        eventDate: a.eventDate,
        createdAt: a.createdAt,
      })),
    };
  }

  async debugActivityCounts(
    params: {
      from?: string;
      to?: string;
    },
    user?: RbacUser,
  ) {
    const allowedLocalityIds = await this.getTargetLocalityIds();
    if (allowedLocalityIds.length === 0) {
      return {
        specialties: {
          psicologia: { id: null, name: null },
          commission: { id: null, name: null },
        },
        counts: {
          psicologia: 0,
          commission: 0,
          total: 0,
        },
        bySpecialtyId: {},
      };
    }

    const from = params.from ? new Date(params.from) : null;
    const to = params.to ? new Date(params.to) : null;

    // Get specialties
    const psicologiaSpecialty = await this.prisma.specialty.findFirst({
      where: { name: { contains: 'Psicologia', mode: 'insensitive' } },
      select: { id: true, name: true },
    });

    const commissionSpecialty = await this.prisma.specialty.findFirst({
      where: { name: { contains: 'Comissão CIPAVD', mode: 'insensitive' } },
      select: { id: true, name: true },
    });

    const localitiesRaw = await this.prisma.locality.findMany({
      where: {
        id: { in: allowedLocalityIds },
        catalogType: LocalityCatalogType.SMIF,
      },
      orderBy: { name: 'asc' },
    });

    const localityGroups = groupTargetLocalities(localitiesRaw);
    const { aliasByLocalityId } = createTargetLocalityAliasMap(localityGroups);
    const localityIds = Array.from(aliasByLocalityId.keys());

    const activityDateRangeFilter: Prisma.ActivityWhereInput | null =
      from || to
        ? {
            OR: [
              {
                eventDate: {
                  ...(from ? { gte: from } : {}),
                  ...(to ? { lte: to } : {}),
                },
              },
              {
                eventDate: null,
                createdAt: {
                  ...(from ? { gte: from } : {}),
                  ...(to ? { lte: to } : {}),
                },
              },
            ],
          }
        : null;

    const activities: any[] = await this.prisma.activity.findMany({
      where: {
        localityId: { in: localityIds },
        ...(activityDateRangeFilter ?? {}),
      },
      include: {
        specialty: {
          select: {
            id: true,
            name: true,
          },
        },
        specialties: {
          select: {
            specialtyId: true,
            specialty: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        activityType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    } as any);

    const filteredActivities = activities.filter((activity) =>
      activity.localityId ? aliasByLocalityId.has(activity.localityId) : false,
    );

    // Count Psicologia
    const psicologia = filteredActivities.filter((a) => {
      const specialties = this.getActivitySpecialties(a);
      const normalizedNames = this.resolveActivitySpecialtyNormalizedNames(a);
      return (
        (psicologiaSpecialty &&
          specialties.some((entry) => entry.id === psicologiaSpecialty.id)) ||
        normalizedNames.some((name) => name.includes('psicologia'))
      );
    });

    // Count Comissão CIPAVD
    const commission = filteredActivities.filter((a) => {
      const specialties = this.getActivitySpecialties(a);
      if (specialties.length === 0) return true;
      const normalizedNames = this.resolveActivitySpecialtyNormalizedNames(a);
      return (
        (commissionSpecialty &&
          specialties.some((entry) => entry.id === commissionSpecialty.id)) ||
        normalizedNames.some((name) => name.includes('comissao cipavd'))
      );
    });

    return {
      specialties: {
        psicologia: {
          id: psicologiaSpecialty?.id || null,
          name: psicologiaSpecialty?.name || null,
        },
        commission: {
          id: commissionSpecialty?.id || null,
          name: commissionSpecialty?.name || null,
        },
      },
      counts: {
        psicologia: psicologia.length,
        commission: commission.length,
        total: filteredActivities.length,
      },
      bySpecialtyId: (() => {
        const byId: Record<string, number> = {};
        for (const act of filteredActivities) {
          const specialtyIds = this.getActivitySpecialties(act).map(
            (entry) => entry.id || 'NULL',
          );
          const uniqueIds = specialtyIds.length > 0 ? specialtyIds : ['NULL'];
          for (const key of new Set(uniqueIds)) {
            byId[key] = (byId[key] || 0) + 1;
          }
        }
        return byId;
      })(),
      activitiesSample: filteredActivities.map((act) => ({
        id: act.id,
        title: act.title,
        specialtyId: act.specialtyId,
        specialtyName: act.specialty?.name ?? null,
        specialtyIds: this.getActivitySpecialties(act).map((entry) => entry.id),
        specialtyNames: this.getActivitySpecialties(act).map(
          (entry) => entry.name,
        ),
        activityTypeId: act.activityTypeId,
        activityTypeName: act.activityType?.name ?? null,
      })),
    };
  }

  private getActivitySpecialties(activity: any) {
    const fromLinks = Array.isArray(activity?.specialties)
      ? activity.specialties
          .map((entry: any) => entry?.specialty)
          .filter((entry: any) => Boolean(entry?.id))
          .map((entry: any) => ({
            id: String(entry.id),
            name: String(entry.name ?? '').trim() || 'Especialidade',
          }))
      : [];
    const fallback =
      activity?.specialty && String(activity.specialty?.id ?? '').trim()
        ? [
            {
              id: String(activity.specialty.id),
              name:
                String(activity.specialty.name ?? '').trim() || 'Especialidade',
            },
          ]
        : [];
    const merged = [...fromLinks, ...fallback];
    const unique = new Map<string, { id: string; name: string }>();
    for (const specialty of merged) {
      if (!specialty.id) continue;
      if (!unique.has(specialty.id)) unique.set(specialty.id, specialty);
    }
    return Array.from(unique.values());
  }

  private resolveActivitySpecialtyNormalizedNames(
    activity: any,
    fallbackName?: string,
  ) {
    const names = this.getActivitySpecialties(activity)
      .map((entry) => String(entry.name ?? '').trim())
      .filter(Boolean);
    if (names.length === 0 && fallbackName) {
      names.push(String(fallbackName).trim());
    }
    if (names.length === 0) {
      names.push('Comissão CIPAVD');
    }
    return names.map((value) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase(),
    );
  }

  private applyProgressRules(status: TaskStatus, progressPercent: number) {
    if (status === TaskStatus.NOT_STARTED) return 0;
    if (status === TaskStatus.DONE) return 100;
    if (progressPercent >= 100) return 99;
    if (progressPercent < 0) return 0;
    return progressPercent;
  }

  private isLate(instance: { dueDate: Date; status: TaskStatus }) {
    return (
      instance.status !== TaskStatus.DONE &&
      instance.dueDate.getTime() < Date.now()
    );
  }

  private isBlocked(
    blockedByIds?: string[] | null,
    statusById?: Map<string, TaskStatus>,
  ) {
    if (!Array.isArray(blockedByIds) || blockedByIds.length === 0) return false;
    if (!statusById) return true;
    return blockedByIds.some((id) => statusById.get(id) !== TaskStatus.DONE);
  }

  private isTaskUnassigned(task: {
    assignedToId?: string | null;
    assignedEloId?: string | null;
    externalAssigneeName?: string | null;
    responsibles?: Array<{ userId?: string | null }>;
  }) {
    const hasResponsibleUsers =
      Array.isArray(task.responsibles) &&
      task.responsibles.some((entry) => Boolean(entry?.userId));
    return (
      !task.assignedToId &&
      !task.assignedEloId &&
      !task.externalAssigneeName &&
      !hasResponsibleUsers
    );
  }

  private normalizeAssigneeSelection(payload: {
    assigneeIds?: string[];
    assignedToId?: string | null;
    assigneeType?:
      | 'USER'
      | 'ELO'
      | 'LOCALITY_COMMAND'
      | 'LOCALITY_COMMANDER'
      | null;
    assigneeId?: string | null;
  }): { type: TaskAssigneeType | null; id: string | null } {
    if (payload.assigneeType) {
      if (payload.assigneeType === 'USER' || payload.assigneeType === 'ELO') {
        return {
          type: payload.assigneeType,
          id: payload.assigneeId?.trim() || null,
        };
      }
      return { type: payload.assigneeType, id: null };
    }

    if (payload.assignedToId !== undefined) {
      const legacyId = payload.assignedToId?.trim() || null;
      if (!legacyId) return { type: null, id: null };
      return { type: TaskAssigneeType.USER, id: legacyId };
    }

    return { type: null, id: null };
  }

  private async attachTaskCommentSummary(items: any[], user?: RbacUser) {
    if (!Array.isArray(items) || items.length === 0) return items;

    const ids = items.map((item) => item.id);
    const [comments, reads] = await this.prisma.$transaction([
      this.prisma.taskComment.findMany({
        where: { taskInstanceId: { in: ids } },
        select: { taskInstanceId: true, authorId: true, createdAt: true },
      }),
      user?.id
        ? this.prisma.taskCommentRead.findMany({
            where: { taskInstanceId: { in: ids }, userId: user.id },
            select: { taskInstanceId: true, seenAt: true },
          })
        : this.prisma.taskCommentRead.findMany({
            where: { taskInstanceId: { in: [] } },
            select: { taskInstanceId: true, seenAt: true },
          }),
    ]);

    const seenAtByTask = new Map<string, Date>();
    for (const read of reads)
      seenAtByTask.set(read.taskInstanceId, read.seenAt);

    const summaryByTask = new Map<
      string,
      { total: number; unread: number; lastCommentAt: Date | null }
    >();
    for (const id of ids) {
      summaryByTask.set(id, { total: 0, unread: 0, lastCommentAt: null });
    }

    for (const comment of comments) {
      const current = summaryByTask.get(comment.taskInstanceId) ?? {
        total: 0,
        unread: 0,
        lastCommentAt: null,
      };
      current.total += 1;
      if (!current.lastCommentAt || comment.createdAt > current.lastCommentAt) {
        current.lastCommentAt = comment.createdAt;
      }
      if (user?.id && comment.authorId !== user.id) {
        const seenAt = seenAtByTask.get(comment.taskInstanceId);
        if (!seenAt || comment.createdAt > seenAt) {
          current.unread += 1;
        }
      }
      summaryByTask.set(comment.taskInstanceId, current);
    }

    return items.map((item) => {
      const summary = summaryByTask.get(item.id) ?? {
        total: 0,
        unread: 0,
        lastCommentAt: null,
      };
      return {
        ...item,
        comments: {
          total: summary.total,
          unread: summary.unread,
          hasUnread: summary.unread > 0,
          lastCommentAt: summary.lastCommentAt,
        },
      };
    });
  }

  private async resolveManualTaskTemplate(phaseId: string) {
    const existing = await this.prisma.taskTemplate.findFirst({
      where: {
        deletedAt: null,
        title: this.manualTaskTemplateTitle,
        description: this.manualTaskTemplateDescription,
        phaseId,
        specialtyId: null,
        eloRoleId: null,
      },
      select: { id: true },
    });
    if (existing) return existing;

    return this.prisma.taskTemplate.create({
      data: {
        title: this.manualTaskTemplateTitle,
        description: this.manualTaskTemplateDescription,
        phase: { connect: { id: phaseId } },
        appliesToAllLocalities: false,
        reportRequiredDefault: false,
      },
      select: { id: true },
    });
  }

  private mapTaskInstance(instance: any, executiveHidePii?: boolean) {
    const assignee = this.resolveAssignee(instance);
    const responsibleUsers = Array.isArray(instance.responsibles)
      ? instance.responsibles
          .map((entry: any) => entry?.user)
          .filter(Boolean)
          .map((user: any) => ({
            id: user.id,
            name:
              user.name ??
              user.email ??
              `Usuário ${String(user.id).slice(0, 8)}`,
            email: user.email ?? null,
          }))
      : [];
    const mapped = {
      ...instance,
      title:
        instance.title ??
        instance.titleOverride ??
        instance.taskTemplate?.title ??
        null,
      localityName: instance.localityName ?? instance.locality?.name ?? null,
      localityCode: instance.localityCode ?? instance.locality?.code ?? null,
      specialtyId:
        instance.specialtyId ?? instance.taskTemplate?.specialtyId ?? null,
      specialtyName:
        instance.specialty?.name ??
        instance.taskTemplate?.specialty?.name ??
        null,
      isLate: this.isLate(instance),
      blockedByIds: (instance.blockedByIdsJson as string[] | null) ?? null,
      hasAssignee: !this.isTaskUnassigned(instance),
      responsibleUsers: executiveHidePii ? [] : responsibleUsers,
      assignee: executiveHidePii ? null : assignee,
      assigneeLabel: executiveHidePii ? null : (assignee?.label ?? null),
    };

    delete mapped.blockedByIdsJson;
    delete mapped.responsibles;

    if (executiveHidePii) {
      delete mapped.assignedTo;
      delete mapped.assignedToId;
      delete mapped.assignedElo;
      delete mapped.assignedEloId;
      delete mapped.externalAssigneeName;
      delete mapped.externalAssigneeRole;
    }

    return mapped;
  }

  private mapTaskComment(comment: any, executiveHidePii?: boolean) {
    return {
      id: comment.id,
      taskInstanceId: comment.taskInstanceId,
      text: comment.text,
      createdAt: comment.createdAt,
      author: executiveHidePii
        ? null
        : comment.author
          ? {
              id: comment.author.id,
              name: comment.author.name ?? comment.author.email ?? 'Usuário',
            }
          : null,
      authorName: executiveHidePii
        ? 'Usuário interno'
        : (comment.author?.name ?? comment.author?.email ?? 'Usuário'),
    };
  }

  private sanitizeCommentText(input: string) {
    return String(input ?? '')
      .replace(/[<>]/g, '')
      .replace(/\r\n/g, '\n')
      .trim();
  }

  private resolveAssignee(
    instance: any,
  ): { type: string; id: string | null; name: string; label: string } | null {
    const responsibleUsers = Array.isArray(instance.responsibles)
      ? instance.responsibles.map((entry: any) => entry?.user).filter(Boolean)
      : [];

    if (responsibleUsers.length > 1) {
      const labels = responsibleUsers.map(
        (user: any) =>
          user.name || user.email || `Usuário ${String(user.id).slice(0, 8)}`,
      );
      return {
        type: 'USERS',
        id: null,
        name: labels.join(', '),
        label: labels.join(', '),
      };
    }

    if (responsibleUsers.length === 1) {
      const responsible = responsibleUsers[0];
      const name =
        responsible.name ||
        responsible.email ||
        `Usuário ${String(responsible.id).slice(0, 8)}`;
      return {
        type: TaskAssigneeType.USER,
        id: responsible.id,
        name,
        label: name,
      };
    }

    if (instance.assignedTo) {
      const name =
        instance.assignedTo.name ||
        instance.assignedTo.email ||
        `Usuário ${String(instance.assignedTo.id).slice(0, 8)}`;
      return {
        type: TaskAssigneeType.USER,
        id: instance.assignedTo.id,
        name,
        label: name,
      };
    }

    if (instance.assignedElo) {
      const role =
        instance.assignedElo.eloRole?.name ??
        instance.assignedElo.eloRole?.code ??
        'Elo';
      const name = instance.assignedElo.name || 'Elo';
      return {
        type: TaskAssigneeType.ELO,
        id: instance.assignedElo.id,
        name,
        label: `${role}: ${name}`,
      };
    }

    if (instance.externalAssigneeName) {
      const role = instance.externalAssigneeRole?.trim();
      const name = String(instance.externalAssigneeName);
      return {
        type: instance.assigneeType ?? 'EXTERNAL',
        id: null,
        name,
        label: role ? `${role}: ${name}` : name,
      };
    }

    return null;
  }

  private mapPhase(phase: {
    id: string;
    name: string;
    displayName: string | null;
    order: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const fallback = this.phaseLabelByCode[phase.name] ?? phase.name;
    const display = phase.displayName?.trim();
    return {
      ...phase,
      code: phase.name,
      defaultName: fallback,
      name: display || fallback,
      displayName: display || null,
    };
  }

  private getScopeConstraints(user?: RbacUser) {
    if (!user) return {};
    const profile = resolveAccessProfile(user);
    if (profile.ti || profile.nationalCommission) return {};
    if (profile.localityAdmin) {
      return {
        localityId: user.localityId ?? undefined,
        specialtyId: undefined,
      };
    }
    if (profile.specialtyAdmin) {
      return {
        localityId: user.localityId ?? undefined,
        specialtyId: user.specialtyId ?? undefined,
      };
    }
    return {
      localityId: user.localityId ?? undefined,
      specialtyId: user.specialtyId ?? undefined,
    };
  }

  private assertConstraints(
    localityId: string,
    specialtyId: string | null,
    user?: RbacUser,
  ) {
    const constraints = this.getScopeConstraints(user);
    if (constraints.localityId && constraints.localityId !== localityId) {
      throwError('RBAC_FORBIDDEN');
    }
    if (
      constraints.specialtyId &&
      specialtyId &&
      constraints.specialtyId !== specialtyId
    ) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private buildTaskAccessWhere(
    user: RbacUser | undefined,
    mode: 'view' | 'operate' | 'assign',
  ): Prisma.TaskInstanceWhereInput {
    if (!user?.id) return {};
    const profile = resolveAccessProfile(user);

    if (mode === 'operate') {
      if (profile.ti || profile.nationalCommission) return {};
      return { id: '__forbidden__' };
    }

    if (mode === 'assign') {
      if (profile.ti || profile.nationalCommission) return {};
      if (profile.localityAdmin && profile.localityId) {
        return { localityId: profile.localityId };
      }
      if (profile.specialtyAdmin) {
        const and: Prisma.TaskInstanceWhereInput[] = [];
        if (profile.localityId) and.push({ localityId: profile.localityId });
        const groupOr: Prisma.TaskInstanceWhereInput[] = [];
        if (profile.groupSpecialtyId) {
          groupOr.push({
            OR: [
              { specialtyId: null },
              { specialtyId: profile.groupSpecialtyId },
            ],
          });
        }
        if (profile.groupEloRoleId) {
          groupOr.push({ eloRoleId: profile.groupEloRoleId });
          groupOr.push({ assignedElo: { eloRoleId: profile.groupEloRoleId } });
        }
        if (groupOr.length > 0) and.push({ OR: groupOr });
        if (and.length === 0) return { id: '__forbidden__' };
        return and.length === 1 ? and[0] : { AND: and };
      }
      return { id: '__forbidden__' };
    }

    if (profile.ti || profile.nationalCommission) return {};
    if (profile.localityAdmin && profile.localityId) {
      return { localityId: profile.localityId };
    }
    if (profile.specialtyAdmin) {
      const and: Prisma.TaskInstanceWhereInput[] = [];
      if (profile.localityId) and.push({ localityId: profile.localityId });
      const groupOr: Prisma.TaskInstanceWhereInput[] = [];
      if (profile.groupSpecialtyId) {
        groupOr.push({
          OR: [
            { specialtyId: null },
            { specialtyId: profile.groupSpecialtyId },
          ],
        });
      }
      if (profile.groupEloRoleId) {
        groupOr.push({ eloRoleId: profile.groupEloRoleId });
        groupOr.push({ assignedElo: { eloRoleId: profile.groupEloRoleId } });
      }
      if (groupOr.length > 0) and.push({ OR: groupOr });
      if (and.length === 0) return { id: '__forbidden__' };
      return and.length === 1 ? and[0] : { AND: and };
    }

    const viewerOr: Prisma.TaskInstanceWhereInput[] = [
      { assignedToId: user.id },
      { responsibles: { some: { userId: user.id } } },
    ];
    if (user.localityId) {
      const groupOr: Prisma.TaskInstanceWhereInput[] = [];
      if (user.specialtyId) {
        groupOr.push({
          OR: [{ specialtyId: null }, { specialtyId: user.specialtyId }],
        });
      }
      if (user.eloRoleId) {
        groupOr.push({ eloRoleId: user.eloRoleId });
        groupOr.push({ assignedElo: { eloRoleId: user.eloRoleId } });
      }
      if (groupOr.length > 0) {
        viewerOr.push({
          localityId: user.localityId,
          OR: groupOr,
        });
      }
    }
    return { OR: viewerOr };
  }

  private isTaskResponsibleUser(instance: any, user: RbacUser | undefined) {
    if (!user?.id) return false;
    if (instance?.assignedToId === user.id) return true;
    if (Array.isArray(instance?.responsibles)) {
      return instance.responsibles.some(
        (entry: any) => (entry?.userId ?? entry?.user?.id) === user.id,
      );
    }
    return false;
  }

  private matchesTaskSpecialty(instance: any, specialtyId?: string | null) {
    if (!specialtyId) return false;
    const taskSpecialtyId =
      instance?.specialtyId ?? instance?.taskTemplate?.specialtyId ?? null;
    return !taskSpecialtyId || taskSpecialtyId === specialtyId;
  }

  private assertTaskViewAccess(instance: any, user?: RbacUser) {
    if (!user?.id) return;
    const profile = resolveAccessProfile(user);
    if (profile.ti || profile.nationalCommission) return;

    if (profile.localityAdmin) {
      if (!profile.localityId || instance.localityId === profile.localityId)
        return;
      throwError('RBAC_FORBIDDEN');
    }

    const specialtyMatch = this.matchesTaskSpecialty(
      instance,
      profile.groupSpecialtyId,
    );
    const eloRoleMatch = profile.groupEloRoleId
      ? instance.eloRoleId === profile.groupEloRoleId ||
        instance.assignedElo?.eloRoleId === profile.groupEloRoleId
      : false;

    if (profile.specialtyAdmin) {
      if (profile.localityId && instance.localityId !== profile.localityId) {
        throwError('RBAC_FORBIDDEN');
      }
      if (specialtyMatch || eloRoleMatch) return;
      throwError('RBAC_FORBIDDEN');
    }

    if (this.isTaskResponsibleUser(instance, user)) return;
    if (
      user.localityId &&
      instance.localityId === user.localityId &&
      (specialtyMatch || eloRoleMatch)
    )
      return;

    throwError('RBAC_FORBIDDEN');
  }

  private assertTaskOperateAccess(_instance: any, user?: RbacUser) {
    if (!user?.id) throwError('RBAC_FORBIDDEN');
    const profile = resolveAccessProfile(user);
    if (profile.ti || profile.nationalCommission) return;
    throwError('RBAC_FORBIDDEN');
  }

  private assertCanAssignInLocality(_localityId: string, user?: RbacUser) {
    if (!user?.id) throwError('RBAC_FORBIDDEN');
    const profile = resolveAccessProfile(user);
    if (profile.ti || profile.nationalCommission) return;
    throwError('RBAC_FORBIDDEN');
  }

  private assertCanAssignInTaskScope(_instance: any, user?: RbacUser) {
    if (!user?.id) throwError('RBAC_FORBIDDEN');
    const profile = resolveAccessProfile(user);
    if (profile.ti || profile.nationalCommission) return;
    throwError('RBAC_FORBIDDEN');
  }

  private assertDeleteAccess(user?: RbacUser) {
    if (!user?.id) throwError('RBAC_FORBIDDEN');
    const profile = resolveAccessProfile(user);
    if (profile.ti || profile.nationalCommission) return;
    throwError('RBAC_FORBIDDEN');
  }

  private assertTemplateManageAccess(user?: RbacUser) {
    if (!user?.id) throwError('RBAC_FORBIDDEN');
    const profile = resolveAccessProfile(user);
    if (profile.ti || profile.nationalCommission) return;
    throwError('RBAC_FORBIDDEN');
  }

  private async resolveTaskResponsibleIds(
    localityId: string,
    input: {
      assigneeIds?: string[];
      assignedToId?: string | null;
      selectionType?: TaskAssigneeType | null;
    },
    user?: RbacUser,
  ) {
    const explicitIds = Array.from(
      new Set(
        (input.assigneeIds ?? [])
          .map((value) => String(value ?? '').trim())
          .filter(Boolean),
      ),
    );
    if (input.assignedToId && !explicitIds.includes(input.assignedToId)) {
      explicitIds.push(input.assignedToId);
    }

    // For legacy non-user assignment types, keep empty user responsibles.
    if (input.selectionType && input.selectionType !== TaskAssigneeType.USER) {
      return [];
    }
    if (explicitIds.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: explicitIds }, isActive: true },
      select: { id: true, localityId: true },
    });
    if (users.length !== explicitIds.length) {
      throwError('VALIDATION_ERROR', { reason: 'TASK_RESPONSIBLE_INVALID' });
    }

    const mismatched = users.some(
      (candidate) => candidate.localityId !== localityId,
    );
    if (mismatched) {
      throwError('VALIDATION_ERROR', {
        reason: 'TASK_RESPONSIBLE_LOCALITY_MISMATCH',
      });
    }

    // Guardrail: actor must be allowed to assign in this locality.
    this.assertCanAssignInLocality(localityId, user);
    return users.map((candidate) => candidate.id);
  }

  async updateTaskMeeting(
    id: string,
    meetingId: string | null,
    user?: RbacUser,
  ) {
    const instance = await this.prisma.taskInstance.findUnique({
      where: { id },
      include: {
        taskTemplate: { select: { specialtyId: true } },
        assignedElo: { select: { id: true, eloRoleId: true } },
        responsibles: { select: { userId: true } },
      },
    });
    if (!instance) throwError('NOT_FOUND');
    this.assertTaskOperateAccess(instance, user);

    const updated = await this.prisma.taskInstance.update({
      where: { id },
      data: { meetingId },
      include: {
        meeting: { select: { id: true, datetime: true, scope: true } },
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'task_instances',
      action: 'update_meeting',
      entityId: id,
      localityId: instance.localityId,
      diffJson: { meetingId },
    });

    return this.mapTaskInstance(updated, user?.executiveHidePii);
  }

  async updateTaskEloRole(
    id: string,
    eloRoleId: string | null,
    user?: RbacUser,
  ) {
    const instance = await this.prisma.taskInstance.findUnique({
      where: { id },
      include: {
        taskTemplate: { select: { specialtyId: true } },
        assignedElo: { select: { id: true, eloRoleId: true } },
        responsibles: { select: { userId: true } },
      },
    });
    if (!instance) throwError('NOT_FOUND');
    this.assertTaskOperateAccess(instance, user);

    const updated = await this.prisma.taskInstance.update({
      where: { id },
      data: { eloRoleId },
      include: { eloRole: { select: { id: true, code: true, name: true } } },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'task_instances',
      action: 'update_elo_role',
      entityId: id,
      localityId: instance.localityId,
      diffJson: { eloRoleId },
    });

    return this.mapTaskInstance(updated, user?.executiveHidePii);
  }

  async updateTaskSpecialty(
    id: string,
    specialtyId: string | null,
    user?: RbacUser,
  ) {
    const instance = await this.prisma.taskInstance.findUnique({
      where: { id },
      include: {
        taskTemplate: { select: { specialtyId: true } },
        assignedElo: { select: { id: true, eloRoleId: true } },
        responsibles: { select: { userId: true } },
      },
    });
    if (!instance) throwError('NOT_FOUND');
    this.assertTaskOperateAccess(instance, user);
    this.assertConstraints(instance.localityId, specialtyId, user);

    if (specialtyId) {
      const existing = await this.prisma.specialty.findUnique({
        where: { id: specialtyId },
        select: { id: true },
      });
      if (!existing) throwError('NOT_FOUND');
    }

    const updated = await this.prisma.taskInstance.update({
      where: { id },
      data: { specialtyId },
      include: { specialty: { select: { id: true, name: true, color: true } } },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'task_instances',
      action: 'update_specialty',
      entityId: id,
      localityId: instance.localityId,
      diffJson: { specialtyId },
    });

    return this.mapTaskInstance(updated, user?.executiveHidePii);
  }

  async deleteTaskInstance(id: string, user?: RbacUser) {
    const existing = await this.prisma.taskInstance.findUnique({
      where: { id },
      include: {
        taskTemplate: { select: { title: true } },
      },
    });
    if (!existing) throwError('NOT_FOUND');

    this.assertDeleteAccess(user);

    await this.prisma.$transaction([
      this.prisma.taskCommentRead.deleteMany({ where: { taskInstanceId: id } }),
      this.prisma.taskComment.deleteMany({ where: { taskInstanceId: id } }),
      this.prisma.taskResponsible.deleteMany({ where: { taskInstanceId: id } }),
      this.prisma.report.deleteMany({ where: { taskInstanceId: id } }),
      this.prisma.taskInstance.delete({ where: { id } }),
    ]);

    await this.audit.log({
      userId: user?.id,
      resource: 'task_instances',
      action: 'delete',
      entityId: id,
      localityId: existing.localityId,
      diffJson: {
        title: existing.taskTemplate?.title ?? null,
        localityId: existing.localityId,
      },
    });

    return { ok: true };
  }

  private async hasBlockingDependencies(blockedByIds?: string[] | null) {
    if (!Array.isArray(blockedByIds) || blockedByIds.length === 0) return false;
    const blockers = await this.prisma.taskInstance.findMany({
      where: { id: { in: blockedByIds } },
      select: { status: true },
    });
    return blockers.some((blocker) => blocker.status !== TaskStatus.DONE);
  }

  private buildTaskWhere(
    filters: {
      localityId?: string;
      allowedLocalityIds?: string[];
      phaseId?: string;
      status?: string;
      assigneeId?: string;
      assigneeIds?: string;
      dueFrom?: string;
      dueTo?: string;
      meetingId?: string;
      eloRoleId?: string;
      specialtyId?: string;
    },
    user?: RbacUser,
  ) {
    const andClauses: Prisma.TaskInstanceWhereInput[] = [];

    if (Array.isArray(filters.allowedLocalityIds)) {
      if (filters.allowedLocalityIds.length === 0) {
        andClauses.push({ localityId: '__none__' });
      } else {
        andClauses.push({ localityId: { in: filters.allowedLocalityIds } });
      }
    }
    if (filters.localityId) andClauses.push({ localityId: filters.localityId });
    if (filters.eloRoleId) andClauses.push({ eloRoleId: filters.eloRoleId });
    if (filters.specialtyId)
      andClauses.push({ specialtyId: filters.specialtyId });
    if (filters.status)
      andClauses.push({ status: filters.status as TaskStatus });

    const assigneeIds = (filters.assigneeIds ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (assigneeIds.length > 0) {
      andClauses.push({
        OR: [
          { assignedToId: { in: assigneeIds } },
          { responsibles: { some: { userId: { in: assigneeIds } } } },
        ],
      });
    } else if (filters.assigneeId) {
      andClauses.push({
        OR: [
          { assignedToId: filters.assigneeId },
          { responsibles: { some: { userId: filters.assigneeId } } },
        ],
      });
    }

    if (filters.dueFrom || filters.dueTo) {
      const dueDate: Prisma.DateTimeFilter = {};
      if (filters.dueFrom) dueDate.gte = new Date(filters.dueFrom);
      if (filters.dueTo) dueDate.lte = new Date(filters.dueTo);
      andClauses.push({ dueDate });
    }

    if (filters.phaseId) {
      andClauses.push({ taskTemplate: { phaseId: filters.phaseId } });
    }

    const accessWhere = this.buildTaskAccessWhere(user, 'view');
    if (Object.keys(accessWhere).length > 0) {
      andClauses.push(accessWhere);
    }

    const where: Prisma.TaskInstanceWhereInput =
      andClauses.length > 0 ? { AND: andClauses } : {};
    return { where };
  }

  /**
   * Com filtro por localityId, inclui também as outras instâncias do mesmo groupKey
   * (tarefa multi-localidade). Sem isso o cliente só recebe a ponta da OM filtrada e o
   * agrupamento no front perde as demais localidades após editar.
   */
  private async expandTaskWhereForSharedGroupKey(
    filters: {
      localityId?: string;
      allowedLocalityIds?: string[];
      phaseId?: string;
      status?: string;
      assigneeId?: string;
      assigneeIds?: string;
      dueFrom?: string;
      dueTo?: string;
      meetingId?: string;
      eloRoleId?: string;
      specialtyId?: string;
    },
    whereWithLocalityAndMeeting: Prisma.TaskInstanceWhereInput,
    user?: RbacUser,
  ): Promise<Prisma.TaskInstanceWhereInput> {
    if (!filters.localityId) return whereWithLocalityAndMeeting;

    const anchorRows = await this.prisma.taskInstance.findMany({
      where: whereWithLocalityAndMeeting,
      select: { groupKey: true },
    });
    const groupKeys = Array.from(
      new Set(
        anchorRows
          .map((row) => String(row.groupKey ?? '').trim())
          .filter(Boolean),
      ),
    );
    if (groupKeys.length === 0) return whereWithLocalityAndMeeting;

    const { where: withoutLocality } = this.buildTaskWhere(
      {
        ...filters,
        localityId: undefined,
      },
      user,
    );
    if (filters.meetingId) withoutLocality.meetingId = filters.meetingId;
    if (filters.eloRoleId) withoutLocality.eloRoleId = filters.eloRoleId;

    return {
      AND: [
        withoutLocality,
        {
          OR: [
            { localityId: filters.localityId },
            { groupKey: { in: groupKeys } },
          ],
        },
      ],
    };
  }

  private taskInstanceListInclude(): Prisma.TaskInstanceInclude {
    return {
      locality: { select: { id: true, name: true, code: true } },
      specialty: { select: { id: true, name: true, color: true } },
      taskTemplate: { select: { id: true, title: true, phaseId: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      assignedElo: {
        include: {
          eloRole: { select: { id: true, code: true, name: true } },
        },
      },
      responsibles: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              localityId: true,
              specialtyId: true,
              eloRoleId: true,
            },
          },
        },
        orderBy: [{ createdAt: 'asc' }],
      },
      meeting: { select: { id: true, datetime: true, scope: true } },
      eloRole: { select: { id: true, code: true, name: true } },
    };
  }

  /**
   * Paginação (skip/take) pode trazer só uma instância de um grupo multi-localidade.
   * Busca as demais instâncias com o mesmo groupKey que ainda obedecem ao mesmo where.
   */
  private async mergeTaskGroupSiblingsIntoPage(
    pageItems: any[],
    finalWhere: Prisma.TaskInstanceWhereInput,
  ): Promise<any[]> {
    const groupKeys = Array.from(
      new Set(
        pageItems
          .map((row) => String(row.groupKey ?? '').trim())
          .filter(Boolean),
      ),
    );
    if (groupKeys.length === 0) return pageItems;

    const existingIds = pageItems.map((row) => row.id);

    const siblings = await this.prisma.taskInstance.findMany({
      where: {
        AND: [
          finalWhere,
          { groupKey: { in: groupKeys } },
          { id: { notIn: existingIds } },
        ],
      },
      orderBy: { dueDate: 'asc' },
      include: this.taskInstanceListInclude(),
    });

    if (siblings.length === 0) return pageItems;

    const merged = [...pageItems, ...siblings];
    merged.sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    );
    return merged;
  }

  async listTaskInstancesForExport(
    filters: {
      localityId?: string;
      allowedLocalityIds?: string[];
      phaseId?: string;
      status?: string;
      assigneeId?: string;
      assigneeIds?: string;
      dueFrom?: string;
      dueTo?: string;
      specialtyId?: string;
    },
    user?: RbacUser,
  ) {
    const allowedLocalityIds =
      await this.allowedLocalityIdsForTaskQueries(user);
    if (allowedLocalityIds !== undefined && allowedLocalityIds.length === 0)
      return [];
    const { where } = this.buildTaskWhere(
      { ...filters, allowedLocalityIds },
      user,
    );

    const finalWhere = await this.expandTaskWhereForSharedGroupKey(
      { ...filters, allowedLocalityIds },
      where,
      user,
    );

    const items = await this.prisma.taskInstance.findMany({
      where: finalWhere,
      include: {
        taskTemplate: {
          include: { phase: true, specialty: true, eloRole: true },
        },
        locality: true,
        specialty: { select: { id: true, name: true, color: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        assignedElo: {
          include: {
            eloRole: { select: { id: true, code: true, name: true } },
          },
        },
        responsibles: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                localityId: true,
                specialtyId: true,
                eloRoleId: true,
              },
            },
          },
          orderBy: [{ createdAt: 'asc' }],
        },
        meeting: { select: { id: true, datetime: true, scope: true } },
        eloRole: { select: { id: true, code: true, name: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    return items.map((item) =>
      this.mapTaskInstance(item, user?.executiveHidePii),
    );
  }

  private async getDashboardNationalCardSettings() {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        description: string;
        backgroundColor: string;
        textColor: string;
      }>
    >(Prisma.sql`
      SELECT "id", "title", "description", "backgroundColor", "textColor"
      FROM "DashboardNationalCardSetting"
    `);

    const byId = new Map(rows.map((row) => [row.id, row]));
    return DASHBOARD_NATIONAL_CARD_SETTING_DEFAULTS.map((defaults) => {
      const row = byId.get(defaults.id);
      return {
        id: defaults.id,
        title: this.sanitizeRequiredTextOrFallback(row?.title, defaults.title),
        description: this.sanitizeRequiredTextOrFallback(
          row?.description,
          defaults.description,
        ),
        backgroundColor: this.normalizeHexColor(
          row?.backgroundColor,
          defaults.backgroundColor,
        ),
        textColor: this.normalizeHexColor(row?.textColor, defaults.textColor),
      };
    });
  }

  private assertDashboardNationalCardManageAccess(user?: RbacUser) {
    if (hasPermission(user, 'dashboard', 'update', PermissionScope.NATIONAL)) {
      return;
    }
    throwError('RBAC_FORBIDDEN');
  }

  private sanitizeRequiredText(value: string, field: string) {
    const normalized = sanitizeText(value ?? '');
    if (!normalized.trim()) {
      throwError('VALIDATION_ERROR', { field, reason: 'REQUIRED' });
    }
    return normalized;
  }

  private sanitizeRequiredTextOrFallback(
    value: string | null | undefined,
    fallback: string,
  ) {
    const normalized = sanitizeText(value ?? '').trim();
    if (normalized) return normalized;
    return fallback;
  }

  private normalizeHexColor(
    value: string | null | undefined,
    fallback: string,
  ) {
    const normalized = String(value ?? '').trim();
    if (!normalized) return fallback;
    if (!/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(normalized)) {
      return fallback;
    }
    return normalized.toUpperCase();
  }

  private parsePagination(pageRaw?: string, pageSizeRaw?: string) {
    const page = Math.max(1, Number(pageRaw ?? 1) || 1);
    const pageSize = Math.min(
      100,
      Math.max(10, Number(pageSizeRaw ?? 20) || 20),
    );
    const skip = (page - 1) * pageSize;
    return { page, pageSize, skip, take: pageSize };
  }

  private async getTargetLocalityIds() {
    const localities = await this.prisma.locality.findMany({
      where: { catalogType: LocalityCatalogType.SMIF },
      select: {
        id: true,
        name: true,
        recruitsFemaleCountCurrent: true,
        updatedAt: true,
      },
    });
    return selectTargetLocalities(localities).map((locality) => locality.id);
  }
}
