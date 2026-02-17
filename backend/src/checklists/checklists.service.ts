import { Injectable } from '@nestjs/common';
import { Prisma, ActivityStatus, ChecklistItemStatusType, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RbacUser } from '../rbac/rbac.types';
import { throwError } from '../common/http-error';
import { sanitizeText } from '../common/sanitize';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ChecklistsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(filters: { phaseId?: string; specialtyId?: string; eloRoleId?: string }, user?: RbacUser) {
    const constraints = this.getScopeConstraints(user);

    const localityWhere: Prisma.LocalityWhereInput = {};
    if (constraints.localityId) localityWhere.id = constraints.localityId;

    const checklistWhere: Prisma.ChecklistWhereInput = {};
    if (filters.phaseId) checklistWhere.phaseId = filters.phaseId;
    if (filters.specialtyId) checklistWhere.specialtyId = filters.specialtyId;
    if (constraints.specialtyId) checklistWhere.specialtyId = constraints.specialtyId;
    if (constraints.eloRoleId) checklistWhere.eloRoleId = constraints.eloRoleId;
    if (filters.eloRoleId) checklistWhere.eloRoleId = filters.eloRoleId;

    const [localities, checklists] = await this.prisma.$transaction([
      this.prisma.locality.findMany({ where: localityWhere, orderBy: { name: 'asc' } }),
      this.prisma.checklist.findMany({
        where: checklistWhere,
        include: {
          phase: true,
          specialty: true,
          eloRole: { select: { id: true, code: true, name: true } },
          items: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (checklists.length === 0) {
      const autoItems = await this.buildAutomaticChecklistItems(localities, filters, constraints);
      const localityProgress = localities.map((locality) => {
        if (autoItems.length === 0) return { localityId: locality.id, percent: 0 };
        const doneCount = autoItems.filter(
          (item) => item.statuses[locality.id] === ChecklistItemStatusType.DONE,
        ).length;
        return {
          localityId: locality.id,
          percent: Math.round((doneCount / autoItems.length) * 100),
        };
      });
      return {
        items: autoItems.length
          ? [
              {
                id: 'auto-checklist',
                title: 'Checklist Automático',
                phaseId: filters.phaseId ?? null,
                specialtyId: filters.specialtyId ?? null,
                eloRoleId: filters.eloRoleId ?? null,
                eloRole: null,
                items: autoItems,
                localityProgress,
              },
            ]
          : [],
        localities,
      };
    }

    const localityIds = localities.map((l) => l.id);
    const templateIds = checklists.flatMap((c) =>
      c.items.filter((i) => i.taskTemplateId).map((i) => i.taskTemplateId as string),
    );
    const activityChecklistKeys = new Set(
      checklists.flatMap((c) =>
        c.items
          .filter((i) => !i.taskTemplateId)
          .map((i) => this.normalizeChecklistActivityTitle(i.title)),
      ),
    );

    const taskInstances = templateIds.length
      ? await this.prisma.taskInstance.findMany({
          where: {
            taskTemplateId: { in: templateIds },
            localityId: localityIds.length ? { in: localityIds } : undefined,
          },
          select: { taskTemplateId: true, localityId: true, status: true },
        })
      : [];
    const activities = activityChecklistKeys.size > 0 && localityIds.length > 0
      ? await this.prisma.activity.findMany({
          where: { localityId: { in: localityIds } },
          select: { title: true, localityId: true, status: true },
        })
      : [];

    const instanceByTemplateLocality = new Map<string, TaskStatus[]>();
    for (const instance of taskInstances) {
      const key = `${instance.taskTemplateId}:${instance.localityId}`;
      const list = instanceByTemplateLocality.get(key) ?? [];
      list.push(instance.status);
      instanceByTemplateLocality.set(key, list);
    }
    const activityByTitleLocality = new Map<string, ActivityStatus[]>();
    for (const activity of activities) {
      const normalizedTitle = this.normalizeChecklistActivityTitle(activity.title);
      if (!activityChecklistKeys.has(normalizedTitle)) continue;
      const key = `${normalizedTitle}:${activity.localityId}`;
      const list = activityByTitleLocality.get(key) ?? [];
      list.push(activity.status);
      activityByTitleLocality.set(key, list);
    }

    const items = checklists.map((checklist) => {
      const mappedItems = checklist.items.map((item) => {
        const statusesByLocality: Record<string, ChecklistItemStatusType> = {};
        const activityTitleKey = this.normalizeChecklistActivityTitle(item.title);
        for (const locality of localities) {
          const key = `${item.taskTemplateId}:${locality.id}`;
          if (item.taskTemplateId && instanceByTemplateLocality.has(key)) {
            const statuses = instanceByTemplateLocality.get(key) ?? [];
            statusesByLocality[locality.id] = this.aggregateTaskStatus(statuses);
          } else if (item.taskTemplateId) {
            statusesByLocality[locality.id] = ChecklistItemStatusType.NOT_STARTED;
          } else {
            const activityKey = `${activityTitleKey}:${locality.id}`;
            const statuses = activityByTitleLocality.get(activityKey) ?? [];
            statusesByLocality[locality.id] = this.aggregateActivityStatus(statuses);
          }
        }
        return {
          id: item.id,
          title: item.title,
          taskTemplateId: item.taskTemplateId,
          sourceType: item.taskTemplateId ? 'TASK' : 'ACTIVITY',
          statuses: statusesByLocality,
        };
      });

      const localityProgress = localities.map((locality) => {
        if (mappedItems.length === 0) {
          return { localityId: locality.id, percent: 0 };
        }
        const doneCount = mappedItems.filter(
          (item) => item.statuses[locality.id] === ChecklistItemStatusType.DONE,
        ).length;
        return {
          localityId: locality.id,
          percent: Math.round((doneCount / mappedItems.length) * 100),
        };
      });

      return {
        id: checklist.id,
        title: checklist.title,
        phaseId: checklist.phaseId,
        specialtyId: checklist.specialtyId,
        eloRoleId: checklist.eloRoleId,
        eloRole: checklist.eloRole,
        items: mappedItems,
        localityProgress,
      };
    });

    return { items, localities };
  }

  async create(payload: { title: string; phaseId?: string | null; specialtyId?: string | null; eloRoleId?: string | null }, user?: RbacUser) {
    this.assertConstraints(payload.specialtyId ?? null, user);
    const title = sanitizeText(payload.title).trim();
    const existing = await this.prisma.checklist.findFirst({
      where: {
        title: { equals: title, mode: 'insensitive' },
        phaseId: payload.phaseId ?? null,
        specialtyId: payload.specialtyId ?? null,
        eloRoleId: payload.eloRoleId ?? null,
      },
      select: { id: true },
    });
    if (existing) {
      throwError('CONFLICT_UNIQUE', {
        resource: 'checklists',
        field: 'title+phaseId+specialtyId+eloRoleId',
        existingId: existing.id,
      });
    }

    const created = await this.prisma.checklist.create({
      data: {
        title,
        phaseId: payload.phaseId ?? null,
        specialtyId: payload.specialtyId ?? null,
        eloRoleId: payload.eloRoleId ?? null,
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'checklists',
      action: 'create',
      entityId: created.id,
      diffJson: { title: created.title },
    });

    return created;
  }

  async addItem(checklistId: string, payload: { title: string; taskTemplateId?: string | null }, user?: RbacUser) {
    const checklist = await this.prisma.checklist.findUnique({ where: { id: checklistId } });
    if (!checklist) throwError('NOT_FOUND');
    this.assertConstraints(checklist.specialtyId ?? null, user);

    const created = await this.prisma.checklistItem.create({
      data: {
        checklistId,
        title: sanitizeText(payload.title),
        taskTemplateId: payload.taskTemplateId ?? null,
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'checklists',
      action: 'add_item',
      entityId: checklistId,
      diffJson: { itemId: created.id },
    });

    return created;
  }

  async updateStatuses(_updates: { checklistItemId: string; localityId: string; status: string }[], _user?: RbacUser) {
    throwError('CHECKLIST_AUTOMATIC_ONLY');
  }

  private getScopeConstraints(user?: RbacUser) {
    if (!user) return {};
    return {
      localityId: user.localityId ?? undefined,
      specialtyId: user.specialtyId ?? undefined,
      eloRoleId: user.eloRoleId ?? undefined,
    };
  }

  private assertConstraints(specialtyId: string | null, user?: RbacUser) {
    const constraints = this.getScopeConstraints(user);
    if (constraints.specialtyId && constraints.specialtyId !== specialtyId) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private aggregateTaskStatus(statuses: TaskStatus[]) {
    if (statuses.length === 0) return ChecklistItemStatusType.NOT_STARTED;
    const allDone = statuses.every((status) => status === TaskStatus.DONE);
    if (allDone) return ChecklistItemStatusType.DONE;
    const anyProgress = statuses.some((status) => status !== TaskStatus.NOT_STARTED);
    if (anyProgress) return ChecklistItemStatusType.IN_PROGRESS;
    return ChecklistItemStatusType.NOT_STARTED;
  }

  private aggregateActivityStatus(statuses: ActivityStatus[]) {
    if (statuses.length === 0) return ChecklistItemStatusType.NOT_STARTED;
    const allDone = statuses.every((status) => status === ActivityStatus.DONE);
    if (allDone) return ChecklistItemStatusType.DONE;
    const anyProgress = statuses.some((status) =>
      ([ActivityStatus.IN_PROGRESS, ActivityStatus.DONE, ActivityStatus.CANCELLED] as ActivityStatus[]).includes(status),
    );
    if (anyProgress) return ChecklistItemStatusType.IN_PROGRESS;
    return ChecklistItemStatusType.NOT_STARTED;
  }

  private normalizeChecklistActivityTitle(value: string) {
    return (value ?? '').trim().toLocaleLowerCase('pt-BR');
  }

  private async buildAutomaticChecklistItems(
    localities: Array<{ id: string; name: string }>,
    filters: { phaseId?: string; specialtyId?: string; eloRoleId?: string },
    constraints: { localityId?: string; specialtyId?: string; eloRoleId?: string },
  ) {
    const localityIds = localities.map((locality) => locality.id);
    if (localityIds.length === 0) return [];

    const selectedEloRoleId = filters.eloRoleId ?? constraints.eloRoleId;
    const selectedSpecialtyId = filters.specialtyId ?? constraints.specialtyId;

    const taskInstances = await this.prisma.taskInstance.findMany({
      where: {
        localityId: { in: localityIds },
        ...(selectedEloRoleId
          ? {
              OR: [{ eloRoleId: selectedEloRoleId }, { taskTemplate: { eloRoleId: selectedEloRoleId } }],
            }
          : {}),
        taskTemplate: {
          ...(filters.phaseId ? { phaseId: filters.phaseId } : {}),
          ...(selectedSpecialtyId ? { specialtyId: selectedSpecialtyId } : {}),
        },
      },
      select: {
        taskTemplateId: true,
        localityId: true,
        status: true,
        taskTemplate: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    const activities = await this.prisma.activity.findMany({
      where: {
        localityId: { in: localityIds },
      },
      select: { title: true, localityId: true, status: true },
    });

    const templateById = new Map<string, string>();
    const taskStatusByTemplateLocality = new Map<string, TaskStatus[]>();
    for (const instance of taskInstances) {
      if (!instance.taskTemplateId || !instance.taskTemplate?.title) continue;
      templateById.set(instance.taskTemplateId, instance.taskTemplate.title);
      const key = `${instance.taskTemplateId}:${instance.localityId}`;
      const list = taskStatusByTemplateLocality.get(key) ?? [];
      list.push(instance.status);
      taskStatusByTemplateLocality.set(key, list);
    }

    const activityStatusByTitleLocality = new Map<string, ActivityStatus[]>();
    for (const activity of activities) {
      const titleKey = this.normalizeChecklistActivityTitle(activity.title);
      const key = `${titleKey}:${activity.localityId}`;
      const list = activityStatusByTitleLocality.get(key) ?? [];
      list.push(activity.status);
      activityStatusByTitleLocality.set(key, list);
    }

    const automaticTaskItems = Array.from(templateById.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([taskTemplateId, title]) => {
        const statusesByLocality: Record<string, ChecklistItemStatusType> = {};
        for (const locality of localities) {
          const key = `${taskTemplateId}:${locality.id}`;
          const statuses = taskStatusByTemplateLocality.get(key) ?? [];
          statusesByLocality[locality.id] = this.aggregateTaskStatus(statuses);
        }
        return {
          id: `auto-task:${taskTemplateId}`,
          title,
          taskTemplateId,
          sourceType: 'TASK',
          statuses: statusesByLocality,
        };
      });

    const activityTitles = Array.from(
      new Set(activities.map((activity) => this.normalizeChecklistActivityTitle(activity.title))),
    ).filter(Boolean);

    const automaticActivityItems = activityTitles
      .sort((a, b) => a.localeCompare(b))
      .map((titleKey) => {
        const statusesByLocality: Record<string, ChecklistItemStatusType> = {};
        for (const locality of localities) {
          const key = `${titleKey}:${locality.id}`;
          const statuses = activityStatusByTitleLocality.get(key) ?? [];
          statusesByLocality[locality.id] = this.aggregateActivityStatus(statuses);
        }
        return {
          id: `auto-activity:${titleKey}`,
          title: activities.find((item) => this.normalizeChecklistActivityTitle(item.title) === titleKey)?.title ?? titleKey,
          taskTemplateId: null,
          sourceType: 'ACTIVITY',
          statuses: statusesByLocality,
        };
      });

    return [...automaticTaskItems, ...automaticActivityItems];
  }
}
