import { Injectable } from '@nestjs/common';
import { Prisma, ChecklistItemStatusType, TaskStatus } from '@prisma/client';
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

  async list(filters: { phaseId?: string; specialtyId?: string }, user?: RbacUser) {
    const constraints = this.getScopeConstraints(user);

    const localityWhere: Prisma.LocalityWhereInput = {};
    if (constraints.localityId) localityWhere.id = constraints.localityId;

    const checklistWhere: Prisma.ChecklistWhereInput = {};
    if (filters.phaseId) checklistWhere.phaseId = filters.phaseId;
    if (filters.specialtyId) checklistWhere.specialtyId = filters.specialtyId;
    if (constraints.specialtyId) checklistWhere.specialtyId = constraints.specialtyId;

    const [localities, checklists] = await this.prisma.$transaction([
      this.prisma.locality.findMany({ where: localityWhere, orderBy: { name: 'asc' } }),
      this.prisma.checklist.findMany({
        where: checklistWhere,
        include: {
          phase: true,
          specialty: true,
          items: { include: { statuses: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const localityIds = localities.map((l) => l.id);
    const templateIds = checklists.flatMap((c) =>
      c.items.filter((i) => i.taskTemplateId).map((i) => i.taskTemplateId as string),
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

    const instanceByTemplateLocality = new Map<string, TaskStatus[]>();
    for (const instance of taskInstances) {
      const key = `${instance.taskTemplateId}:${instance.localityId}`;
      const list = instanceByTemplateLocality.get(key) ?? [];
      list.push(instance.status);
      instanceByTemplateLocality.set(key, list);
    }

    const items = checklists.map((checklist) => {
      const mappedItems = checklist.items.map((item) => {
        const statusesByLocality: Record<string, ChecklistItemStatusType> = {};
        for (const locality of localities) {
          const key = `${item.taskTemplateId}:${locality.id}`;
          if (item.taskTemplateId && instanceByTemplateLocality.has(key)) {
            const statuses = instanceByTemplateLocality.get(key) ?? [];
            statusesByLocality[locality.id] = this.aggregateTaskStatus(statuses);
          } else if (item.taskTemplateId) {
            statusesByLocality[locality.id] = ChecklistItemStatusType.NOT_STARTED;
          } else {
            const stored = item.statuses.find((status) => status.localityId === locality.id);
            statusesByLocality[locality.id] = stored?.status ?? ChecklistItemStatusType.NOT_STARTED;
          }
        }
        return {
          id: item.id,
          title: item.title,
          taskTemplateId: item.taskTemplateId,
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
        items: mappedItems,
        localityProgress,
      };
    });

    return { items, localities };
  }

  async create(payload: { title: string; phaseId?: string | null; specialtyId?: string | null }, user?: RbacUser) {
    this.assertConstraints(payload.specialtyId ?? null, user);
    const created = await this.prisma.checklist.create({
      data: {
        title: sanitizeText(payload.title),
        phaseId: payload.phaseId ?? null,
        specialtyId: payload.specialtyId ?? null,
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

  async updateStatuses(updates: { checklistItemId: string; localityId: string; status: string }[], user?: RbacUser) {
    const constraints = this.getScopeConstraints(user);
    const items = await this.prisma.checklistItem.findMany({
      where: { id: { in: updates.map((u) => u.checklistItemId) } },
      include: { checklist: true },
    });
    const itemById = new Map(items.map((item) => [item.id, item]));

    const results: { updated: number; skipped: number } = { updated: 0, skipped: 0 };
    for (const update of updates) {
      const item = itemById.get(update.checklistItemId);
      if (!item) continue;
      this.assertConstraints(item.checklist.specialtyId ?? null, user);
      if (constraints.localityId && constraints.localityId !== update.localityId) {
        throwError('RBAC_FORBIDDEN');
      }
      if (item.taskTemplateId) {
        results.skipped += 1;
        continue;
      }
      await this.prisma.checklistItemStatus.upsert({
        where: {
          checklistItemId_localityId: {
            checklistItemId: update.checklistItemId,
            localityId: update.localityId,
          },
        },
        update: { status: update.status as ChecklistItemStatusType },
        create: {
          checklistItemId: update.checklistItemId,
          localityId: update.localityId,
          status: update.status as ChecklistItemStatusType,
        },
      });
      results.updated += 1;
    }

    await this.audit.log({
      userId: user?.id,
      resource: 'checklists',
      action: 'update_status',
      diffJson: { updated: results.updated, skipped: results.skipped },
    });

    return results;
  }

  private getScopeConstraints(user?: RbacUser) {
    if (!user) return {};
    return {
      localityId: user.localityId ?? undefined,
      specialtyId: user.specialtyId ?? undefined,
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
    const anyProgress = statuses.some((status) =>
      [TaskStatus.STARTED, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED].includes(status),
    );
    if (anyProgress) return ChecklistItemStatusType.IN_PROGRESS;
    return ChecklistItemStatusType.NOT_STARTED;
  }
}

