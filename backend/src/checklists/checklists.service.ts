import { Injectable } from '@nestjs/common';
import {
  Prisma,
  ActivityScope,
  ActivityStatus,
  ChecklistItemStatusType,
  TaskStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RbacUser } from '../rbac/rbac.types';
import { throwError } from '../common/http-error';
import { sanitizeText } from '../common/sanitize';
import { AuditService } from '../audit/audit.service';
import { TasksService } from '../tasks/tasks.service';
import { ActivitiesService } from '../activities/activities.service';
import { resolveAccessProfile } from '../rbac/role-access';
import {
  createTargetLocalityAliasMap,
  groupTargetLocalities,
} from '../common/priority-localities';

@Injectable()
export class ChecklistsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tasks: TasksService,
    private readonly activities: ActivitiesService,
  ) {}

  async list(
    filters: {
      phaseId?: string;
      specialtyId?: string;
      eloRoleId?: string;
      localityId?: string;
    },
    user?: RbacUser,
  ) {
    const constraints = this.getScopeConstraints(user);

    const localityWhere: Prisma.LocalityWhereInput = {};
    if (filters.localityId) localityWhere.id = filters.localityId;
    if (constraints.localityId) localityWhere.id = constraints.localityId;
    /** Inclui OMs-alvo mesmo sem recrutas ativas, para refletir tarefas/atividades reais */

    const localitiesRaw = await this.prisma.locality.findMany({
      where: localityWhere,
      orderBy: { name: 'asc' },
    });
    const localityGroups = groupTargetLocalities(localitiesRaw);
    const localities = localityGroups.map((group) => group.canonical);
    const { aliasIdsByCanonicalId } =
      createTargetLocalityAliasMap(localityGroups);

    /** Sempre visão automática: agrega instâncias de tarefas + atividades de campo (somente leitura no front). */
    const autoItems = await this.buildAutomaticChecklistItems(
      localities,
      filters,
      constraints,
      aliasIdsByCanonicalId,
    );
    const localityProgress = localities.map((locality) => {
      if (autoItems.length === 0)
        return { localityId: locality.id, percent: 0 };
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
              title: 'Tarefas e atividades por localidade',
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

  async create(
    payload: {
      title: string;
      phaseId?: string | null;
      specialtyId?: string | null;
      eloRoleId?: string | null;
    },
    user?: RbacUser,
  ) {
    this.assertConstraints(
      payload.specialtyId ?? null,
      payload.eloRoleId ?? null,
      user,
    );
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

  async addItem(
    checklistId: string,
    payload: { title: string; taskTemplateId?: string | null },
    user?: RbacUser,
  ) {
    const checklist = await this.prisma.checklist.findUnique({
      where: { id: checklistId },
    });
    if (!checklist) throwError('NOT_FOUND');
    this.assertConstraints(
      checklist.specialtyId ?? null,
      checklist.eloRoleId ?? null,
      user,
    );

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

  async updateStatuses(
    updates: { checklistItemId: string; localityId: string; status: string }[],
    user?: RbacUser,
  ) {
    if (!updates?.length) {
      return { updatedTasks: 0, updatedActivities: 0 };
    }

    const normalized = updates
      .map((entry) => ({
        checklistItemId: String(entry.checklistItemId ?? '').trim(),
        localityId: String(entry.localityId ?? '').trim(),
        status: String(entry.status ?? '')
          .trim()
          .toUpperCase(),
      }))
      .filter((entry) => entry.checklistItemId && entry.localityId);

    if (!normalized.length) {
      return { updatedTasks: 0, updatedActivities: 0 };
    }

    const autoUpdates = normalized.filter((entry) =>
      entry.checklistItemId.startsWith('auto-'),
    );
    const dbUpdates = normalized.filter(
      (entry) => !entry.checklistItemId.startsWith('auto-'),
    );

    const itemIds = Array.from(
      new Set(dbUpdates.map((entry) => entry.checklistItemId)),
    );
    const items = itemIds.length
      ? await this.prisma.checklistItem.findMany({
          where: { id: { in: itemIds } },
          select: {
            id: true,
            title: true,
            taskTemplateId: true,
          },
        })
      : [];
    const itemById = new Map(items.map((item) => [item.id, item]));

    const canonicalLocalityIds = Array.from(
      new Set(normalized.map((entry) => entry.localityId)),
    );
    const allLocalities = await this.prisma.locality.findMany({
      where: { id: { in: canonicalLocalityIds } },
      select: {
        id: true,
        name: true,
        code: true,
        recruitsFemaleCountCurrent: true,
        updatedAt: true,
      },
    });
    const localityGroups = groupTargetLocalities(allLocalities);
    const { aliasIdsByCanonicalId } =
      createTargetLocalityAliasMap(localityGroups);

    let updatedTasks = 0;
    let updatedActivities = 0;

    // Atualiza itens vinculados a checklists salvos (template/task + atividade por título)
    for (const entry of dbUpdates) {
      const item = itemById.get(entry.checklistItemId);
      if (!item) continue;

      const targetLocalityIds = aliasIdsByCanonicalId.get(entry.localityId) ?? [
        entry.localityId,
      ];

      const checklistStatus = this.normalizeChecklistTargetStatus(entry.status);
      const targetTaskStatus = this.mapChecklistToTaskStatus(checklistStatus);
      const targetActivityStatus =
        this.mapChecklistToActivityStatus(checklistStatus);

      if (item.taskTemplateId) {
        const instances = await this.prisma.taskInstance.findMany({
          where: {
            taskTemplateId: item.taskTemplateId,
            localityId: { in: targetLocalityIds },
          },
          select: { id: true },
        });
        for (const instance of instances) {
          await this.tasks.updateStatus(instance.id, targetTaskStatus, user);
          updatedTasks += 1;
        }
        continue;
      }

      const normalizedTitle = this.normalizeChecklistActivityTitle(item.title);
      const activities = await this.prisma.activity.findMany({
        where: {
          localityId: { in: targetLocalityIds },
        },
        select: {
          id: true,
          title: true,
        },
      });
      for (const activity of activities) {
        if (
          this.normalizeChecklistActivityTitle(activity.title) !==
          normalizedTitle
        ) {
          continue;
        }
        await this.activities.updateStatus(
          activity.id,
          targetActivityStatus,
          user,
        );
        updatedActivities += 1;
      }
    }

    // Atualiza itens do checklist automático (ids auto-task: / auto-activity:)
    for (const entry of autoUpdates) {
      const checklistStatus = this.normalizeChecklistTargetStatus(entry.status);
      const targetTaskStatus = this.mapChecklistToTaskStatus(checklistStatus);
      const targetActivityStatus =
        this.mapChecklistToActivityStatus(checklistStatus);

      const targetLocalityIds = aliasIdsByCanonicalId.get(entry.localityId) ?? [
        entry.localityId,
      ];

      if (entry.checklistItemId.startsWith('auto-task:')) {
        const taskTemplateId = entry.checklistItemId.slice('auto-task:'.length);
        if (!taskTemplateId) continue;

        const instances = await this.prisma.taskInstance.findMany({
          where: {
            taskTemplateId,
            localityId: { in: targetLocalityIds },
          },
          select: { id: true },
        });
        for (const instance of instances) {
          await this.tasks.updateStatus(instance.id, targetTaskStatus, user);
          updatedTasks += 1;
        }
        continue;
      }

      if (entry.checklistItemId.startsWith('auto-activity:')) {
        const titleKey = entry.checklistItemId.slice('auto-activity:'.length);
        if (!titleKey) continue;

        const activities = await this.prisma.activity.findMany({
          where: {
            localityId: { in: targetLocalityIds },
          },
          select: {
            id: true,
            title: true,
          },
        });
        for (const activity of activities) {
          if (
            this.normalizeChecklistActivityTitle(activity.title) !== titleKey
          ) {
            continue;
          }
          await this.activities.updateStatus(
            activity.id,
            targetActivityStatus,
            user,
          );
          updatedActivities += 1;
        }
      }
    }

    return { updatedTasks, updatedActivities };
  }

  private normalizeChecklistTargetStatus(
    rawStatus: string,
  ): ChecklistItemStatusType {
    const value = String(rawStatus ?? '')
      .trim()
      .toUpperCase();
    if (value === ChecklistItemStatusType.DONE)
      return ChecklistItemStatusType.DONE;
    if (value === ChecklistItemStatusType.IN_PROGRESS)
      return ChecklistItemStatusType.IN_PROGRESS;
    return ChecklistItemStatusType.NOT_STARTED;
  }

  private mapChecklistToTaskStatus(
    status: ChecklistItemStatusType,
  ): TaskStatus {
    if (status === ChecklistItemStatusType.DONE) return TaskStatus.DONE;
    if (status === ChecklistItemStatusType.IN_PROGRESS)
      return TaskStatus.IN_PROGRESS;
    return TaskStatus.NOT_STARTED;
  }

  private mapChecklistToActivityStatus(
    status: ChecklistItemStatusType,
  ): ActivityStatus {
    if (status === ChecklistItemStatusType.DONE) return ActivityStatus.DONE;
    if (status === ChecklistItemStatusType.IN_PROGRESS)
      return ActivityStatus.IN_PROGRESS;
    return ActivityStatus.NOT_STARTED;
  }

  private getScopeConstraints(user?: RbacUser) {
    if (!user) return {};
    const profile = resolveAccessProfile(user);
    if (profile.ti || profile.nationalCommission) {
      return {};
    }
    if (profile.localityAdmin) {
      return {
        localityId: profile.localityId ?? undefined,
        specialtyId: undefined,
        eloRoleId: undefined,
      };
    }
    if (profile.specialtyAdmin) {
      return {
        localityId: profile.localityId ?? undefined,
        specialtyId: profile.groupSpecialtyId ?? undefined,
        eloRoleId: profile.groupEloRoleId ?? undefined,
      };
    }
    return {
      localityId: user.localityId ?? undefined,
      specialtyId: user.specialtyId ?? undefined,
      eloRoleId: user.eloRoleId ?? undefined,
    };
  }

  private assertConstraints(
    specialtyId: string | null,
    eloRoleId: string | null,
    user?: RbacUser,
  ) {
    const constraints = this.getScopeConstraints(user);
    if (constraints.specialtyId && constraints.specialtyId !== specialtyId) {
      throwError('RBAC_FORBIDDEN');
    }
    if (constraints.eloRoleId && constraints.eloRoleId !== eloRoleId) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private aggregateTaskStatus(statuses: TaskStatus[]) {
    if (statuses.length === 0) return ChecklistItemStatusType.NOT_STARTED;
    const allDone = statuses.every((status) => status === TaskStatus.DONE);
    if (allDone) return ChecklistItemStatusType.DONE;
    const anyProgress = statuses.some(
      (status) => status !== TaskStatus.NOT_STARTED,
    );
    if (anyProgress) return ChecklistItemStatusType.IN_PROGRESS;
    return ChecklistItemStatusType.NOT_STARTED;
  }

  private aggregateActivityStatus(statuses: ActivityStatus[]) {
    if (statuses.length === 0) return ChecklistItemStatusType.NOT_STARTED;
    const allDone = statuses.every((status) => status === ActivityStatus.DONE);
    if (allDone) return ChecklistItemStatusType.DONE;
    const anyProgress = statuses.some((status) =>
      (
        [
          ActivityStatus.IN_PROGRESS,
          ActivityStatus.DONE,
          ActivityStatus.CANCELLED,
        ] as ActivityStatus[]
      ).includes(status),
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
    constraints: {
      localityId?: string;
      specialtyId?: string;
      eloRoleId?: string;
    },
    aliasIdsByCanonicalId?: Map<string, string[]>,
  ) {
    const canonicalLocalityIds = localities.map((locality) => locality.id);
    if (canonicalLocalityIds.length === 0) return [];
    const localityIds = aliasIdsByCanonicalId
      ? Array.from(
          new Set(
            canonicalLocalityIds.flatMap(
              (id) => aliasIdsByCanonicalId.get(id) ?? [id],
            ),
          ),
        )
      : canonicalLocalityIds;
    const canonicalByAliasId = new Map<string, string>();
    if (aliasIdsByCanonicalId) {
      for (const [canonicalId, aliases] of aliasIdsByCanonicalId.entries()) {
        for (const aliasId of aliases) {
          canonicalByAliasId.set(aliasId, canonicalId);
        }
      }
    }

    const selectedEloRoleId = filters.eloRoleId ?? constraints.eloRoleId;
    const selectedSpecialtyId = filters.specialtyId ?? constraints.specialtyId;

    const taskInstances = await this.prisma.taskInstance.findMany({
      where: {
        localityId: { in: localityIds },
        ...(selectedSpecialtyId || selectedEloRoleId
          ? {
              AND: [
                ...(selectedSpecialtyId
                  ? [
                      {
                        OR: [
                          { specialtyId: null },
                          { specialtyId: selectedSpecialtyId },
                        ],
                      },
                    ]
                  : []),
                ...(selectedEloRoleId
                  ? [
                      {
                        OR: [
                          { eloRoleId: selectedEloRoleId },
                          { taskTemplate: { eloRoleId: selectedEloRoleId } },
                        ],
                      },
                    ]
                  : []),
              ],
            }
          : {}),
        taskTemplate: {
          ...(filters.phaseId ? { phaseId: filters.phaseId } : {}),
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
        scope: ActivityScope.SMIF,
        // Remove títulos legados da CIPAVD no checklist automático do SMIF.
        NOT: {
          title: { contains: 'CIPAVD', mode: 'insensitive' },
        },
        ...(selectedSpecialtyId
          ? {
              OR: [{ specialtyId: null }, { specialtyId: selectedSpecialtyId }],
            }
          : {}),
        ...(selectedEloRoleId
          ? {
              responsibles: {
                some: {
                  user: { eloRoleId: selectedEloRoleId },
                },
              },
            }
          : {}),
      },
      select: {
        title: true,
        localityId: true,
        status: true,
        specialtyId: true,
        activityType: {
          select: {
            name: true,
          },
        },
      },
    });

    const templateById = new Map<string, string>();
    const taskStatusByTemplateLocality = new Map<string, TaskStatus[]>();
    for (const instance of taskInstances) {
      if (!instance.taskTemplateId || !instance.taskTemplate?.title) continue;
      templateById.set(instance.taskTemplateId, instance.taskTemplate.title);
      const canonicalId =
        canonicalByAliasId.get(instance.localityId) ?? instance.localityId;
      const key = `${instance.taskTemplateId}:${canonicalId}`;
      const list = taskStatusByTemplateLocality.get(key) ?? [];
      list.push(instance.status);
      taskStatusByTemplateLocality.set(key, list);
    }

    const activityStatusByTitleLocality = new Map<string, ActivityStatus[]>();
    const activityTypeByTitle = new Map<string, string | null>();
    for (const activity of activities) {
      if (!activity.localityId) continue;
      const titleKey = this.normalizeChecklistActivityTitle(activity.title);
      const canonicalId =
        canonicalByAliasId.get(activity.localityId) ?? activity.localityId;
      const key = `${titleKey}:${canonicalId}`;
      const list = activityStatusByTitleLocality.get(key) ?? [];
      list.push(activity.status);
      activityStatusByTitleLocality.set(key, list);
      if (!activityTypeByTitle.has(titleKey)) {
        activityTypeByTitle.set(titleKey, activity.activityType?.name ?? null);
      }
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
      new Set(
        activities.map((activity) =>
          this.normalizeChecklistActivityTitle(activity.title),
        ),
      ),
    ).filter(Boolean);

    const automaticActivityItems = activityTitles
      .sort((a, b) => a.localeCompare(b))
      .map((titleKey) => {
        const statusesByLocality: Record<string, ChecklistItemStatusType> = {};
        const availabilityByLocality: Record<string, boolean> = {};
        for (const locality of localities) {
          const key = `${titleKey}:${locality.id}`;
          const statuses = activityStatusByTitleLocality.get(key) ?? [];
          availabilityByLocality[locality.id] = statuses.length > 0;
          statusesByLocality[locality.id] =
            this.aggregateActivityStatus(statuses);
        }
        return {
          id: `auto-activity:${titleKey}`,
          title:
            activities.find(
              (item) =>
                this.normalizeChecklistActivityTitle(item.title) === titleKey,
            )?.title ?? titleKey,
          taskTemplateId: null,
          sourceType: 'ACTIVITY',
          statuses: statusesByLocality,
          availabilityByLocality,
          activityTypeName: activityTypeByTitle.get(titleKey) ?? null,
        };
      })
      .filter((item) =>
        Object.values(item.availabilityByLocality ?? {}).some(Boolean),
      );

    return [...automaticTaskItems, ...automaticActivityItems];
  }
}
