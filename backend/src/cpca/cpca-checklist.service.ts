import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { throwError } from '../common/http-error';
import { sanitizeText } from '../common/sanitize';
import { PrismaService } from '../prisma/prisma.service';
import { hasPermission } from '../rbac/role-access';
import type { RbacUser } from '../rbac/rbac.types';
import {
  CPCA_CHECKLIST_ITEMS,
  CPCA_CHECKLIST_ITEM_KEYS,
  type CpcaChecklistItemKey,
  isCpcaChecklistDirectEmailItem,
  isCpcaChecklistHistoryItem,
  isCpcaChecklistIntraerLinkItem,
  isCpcaChecklistItemKey,
} from './cpca-checklist.constants';

type ChecklistUpdateInput = {
  localityId?: string;
  items: Array<{
    itemKey: string;
    isCompleted: boolean;
    completedAt?: string | null;
    details?: string | null;
    speakerName?: string | null;
    historyEntries?: Array<{
      id?: string | null;
      completedAt: string;
      details?: string | null;
      speakerName?: string | null;
    }>;
  }>;
};

type ChecklistStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

type ChecklistHistoryEntryDraft = {
  id?: string | null;
  completedAt: Date;
  details: string | null;
  speakerName: string | null;
};

type NormalizedChecklistItem =
  | {
      kind: 'BOOLEAN';
      itemKey: CpcaChecklistItemKey;
      isCompleted: boolean;
      completedAt: Date | null;
      details: string | null;
      speakerName: string | null;
    }
  | {
      kind: 'HISTORY';
      itemKey: CpcaChecklistItemKey;
      historyEntries: ChecklistHistoryEntryDraft[];
    };

@Injectable()
export class CpcaChecklistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getLocalityChecklist(
    user: RbacUser | undefined,
    requestedLocalityId?: string,
  ) {
    const localityId = await this.resolveLocalityIdForView(
      user,
      requestedLocalityId,
    );
    const locality = await this.assertOmSupportsCpca(localityId);
    const userId = this.requireUserId(user);
    const userIsPresident = await this.isPresidentUser(userId, localityId);
    const canEdit =
      userIsPresident &&
      (hasPermission(user, 'cpca_cases', 'update', 'LOCALITY') ||
        hasPermission(user, 'cpca_cases', 'update', 'NATIONAL'));

    return {
      locality,
      checklist: await this.buildChecklistSnapshot(localityId),
      canEdit,
      userIsPresident,
    };
  }

  async updateLocalityChecklist(
    payload: ChecklistUpdateInput,
    user: RbacUser | undefined,
  ) {
    const localityId = await this.resolveLocalityIdForUpdate(
      user,
      payload.localityId,
    );
    const locality = await this.assertOmSupportsCpca(localityId);
    const actorUserId = this.requireUserId(user);

    await this.assertPresidentUser(actorUserId, localityId);

    const normalizedItems = this.normalizeChecklistItems(payload.items);
    const existingHistoryEntries = await (
      this.prisma as any
    ).cpcaChecklistHistoryEntry.findMany({
      where: { omId: localityId },
      select: {
        id: true,
        itemKey: true,
        completedAt: true,
        details: true,
        speakerName: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    const existingHistoryByKey = new Map<
      string,
      Array<{
        id: string;
        itemKey: string;
        completedAt: Date;
        details: string | null;
        speakerName: string | null;
        createdAt: Date;
        updatedAt: Date;
      }>
    >();
    for (const entry of existingHistoryEntries) {
      const group = existingHistoryByKey.get(entry.itemKey) ?? [];
      group.push(entry);
      existingHistoryByKey.set(entry.itemKey, group);
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of normalizedItems) {
        if (item.kind === 'BOOLEAN') {
          await tx.cpcaChecklistItem.upsert({
            where: {
              omId_itemKey: {
                omId: localityId,
                itemKey: item.itemKey,
              },
            },
            update: {
              isCompleted: item.isCompleted,
              completedAt: item.completedAt,
              details: item.details,
              speakerName: item.speakerName,
              updatedByUserId: actorUserId,
            },
            create: {
              omId: localityId,
              itemKey: item.itemKey,
              isCompleted: item.isCompleted,
              completedAt: item.completedAt,
              details: item.details,
              speakerName: item.speakerName,
              updatedByUserId: actorUserId,
            },
          });
          continue;
        }

        const existingEntries = existingHistoryByKey.get(item.itemKey) ?? [];
        const nextEntries = await this.syncHistoryEntriesForItem(
          tx,
          localityId,
          item.itemKey,
          actorUserId,
          existingEntries,
          item.historyEntries,
        );
        const latestEntry = this.getLatestHistoryEntry(nextEntries);

        await tx.cpcaChecklistItem.upsert({
          where: {
            omId_itemKey: {
              omId: localityId,
              itemKey: item.itemKey,
            },
          },
          update: {
            isCompleted: Boolean(latestEntry),
            completedAt: latestEntry?.completedAt ?? null,
            details: latestEntry?.details ?? null,
            speakerName: latestEntry?.speakerName ?? null,
            updatedByUserId: actorUserId,
          },
          create: {
            omId: localityId,
            itemKey: item.itemKey,
            isCompleted: Boolean(latestEntry),
            completedAt: latestEntry?.completedAt ?? null,
            details: latestEntry?.details ?? null,
            speakerName: latestEntry?.speakerName ?? null,
            updatedByUserId: actorUserId,
          },
        });
      }
    });

    const checklist = await this.buildChecklistSnapshot(localityId);

    await this.audit.log({
      userId: actorUserId,
      localityId,
      resource: 'cpca_cases',
      action: 'cpca_commission_checklist_update',
      entityId: localityId,
      diffJson: {
        omId: localityId,
        omCode: locality.code,
        omName: locality.name,
        completedCount: checklist.summary.completedCount,
        pendingCount: checklist.summary.pendingCount,
        status: checklist.summary.status,
        items: checklist.items.map((item) => ({
          itemKey: item.itemKey,
          isCompleted: item.isCompleted,
          completedAt: item.completedAt,
          details: item.details,
          speakerName: item.speakerName,
          historyCount: item.historyCount,
          historyEntries: item.historyEntries,
        })),
      },
    });

    return {
      locality,
      checklist,
    };
  }

  async listNationalChecklistOverview(
    user: RbacUser | undefined,
    filters: {
      q?: string;
      uf?: string;
      status?: string;
    },
  ) {
    this.assertCanViewNationalChecklist(user);

    const search = String(filters.q ?? '')
      .trim()
      .toLowerCase();
    const uf = String(filters.uf ?? '')
      .trim()
      .toUpperCase();
    const statusFilter = this.normalizeStatusFilter(filters.status);

    const omWhere: Record<string, unknown> = {
      hasCpca: true,
    };
    if (uf) {
      omWhere.uf = uf;
    }

    const oms: any[] = await (this.prisma as any).om.findMany({
      where: omWhere,
      select: {
        id: true,
        code: true,
        name: true,
        uf: true,
        cpcaCommissionPresident: {
          select: {
            assignedAt: true,
            isSubstitution: true,
            designationBulletin: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        cpcaChecklistItems: {
          select: {
            itemKey: true,
            isCompleted: true,
            completedAt: true,
            details: true,
            speakerName: true,
            updatedAt: true,
          },
        },
        cpcaChecklistHistoryEntries: {
          select: {
            id: true,
            itemKey: true,
            completedAt: true,
            details: true,
            speakerName: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const allItems = oms.map((om: any) => {
      const checklist = this.buildChecklistSnapshotFromRows(
        om.cpcaChecklistItems,
        om.cpcaChecklistHistoryEntries,
      );
      return {
        locality: {
          id: om.id,
          code: om.code,
          name: om.name,
          uf: om.uf ?? null,
        },
        currentPresident: om.cpcaCommissionPresident
          ? {
              assignedAt: om.cpcaCommissionPresident.assignedAt.toISOString(),
              isSubstitution: om.cpcaCommissionPresident.isSubstitution,
              designationBulletin:
                om.cpcaCommissionPresident.designationBulletin ?? null,
              user: om.cpcaCommissionPresident.user,
            }
          : null,
        checklist,
      };
    });

    const filteredItems = allItems
      .filter((item: any) => {
        if (
          statusFilter !== 'ALL' &&
          item.checklist.summary.status !== statusFilter
        ) {
          return false;
        }
        if (!search) return true;

        const presidentName = String(item.currentPresident?.user?.name ?? '')
          .trim()
          .toLowerCase();
        const haystack = [
          item.locality.code,
          item.locality.name,
          item.locality.uf ?? '',
          presidentName,
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(search);
      })
      .sort((a: any, b: any) => {
        const completionDiff =
          a.checklist.summary.completionRate -
          b.checklist.summary.completionRate;
        if (completionDiff !== 0) return completionDiff;
        return `${a.locality.name}`.localeCompare(
          `${b.locality.name}`,
          'pt-BR',
        );
      });

    const availableUfs: string[] = Array.from(
      new Set(
        oms
          .map((om: any) =>
            String(om.uf ?? '')
              .trim()
              .toUpperCase(),
          )
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    return {
      items: filteredItems,
      summary: this.buildNationalSummary(filteredItems),
      filters: {
        q: filters.q ?? '',
        uf,
        status: statusFilter,
        availableUfs,
      },
    };
  }

  private async buildChecklistSnapshot(localityId: string) {
    const [rows, historyEntries] = await Promise.all([
      this.prisma.cpcaChecklistItem.findMany({
        where: { omId: localityId },
        select: {
          itemKey: true,
          isCompleted: true,
          completedAt: true,
          details: true,
          speakerName: true,
          updatedAt: true,
        },
      }),
      (this.prisma as any).cpcaChecklistHistoryEntry.findMany({
        where: { omId: localityId },
        select: {
          id: true,
          itemKey: true,
          completedAt: true,
          details: true,
          speakerName: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return this.buildChecklistSnapshotFromRows(rows, historyEntries);
  }

  private buildChecklistSnapshotFromRows(
    rows: Array<{
      itemKey: string;
      isCompleted: boolean;
      completedAt: Date | null;
      details: string | null;
      speakerName: string | null;
      updatedAt: Date;
    }>,
    historyEntries: Array<{
      id: string;
      itemKey: string;
      completedAt: Date;
      details: string | null;
      speakerName: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>,
  ) {
    const rowsByKey = new Map(rows.map((row) => [row.itemKey, row] as const));
    const historyByKey = new Map<
      string,
      Array<{
        id: string;
        itemKey: string;
        completedAt: Date;
        details: string | null;
        speakerName: string | null;
        createdAt: Date;
        updatedAt: Date;
      }>
    >();
    for (const entry of historyEntries) {
      const group = historyByKey.get(entry.itemKey) ?? [];
      group.push(entry);
      historyByKey.set(entry.itemKey, group);
    }
    const items = CPCA_CHECKLIST_ITEMS.map((definition) => {
      const row = rowsByKey.get(definition.key);
      const itemHistoryEntries = this.sortHistoryEntries(
        historyByKey.get(definition.key) ?? [],
      );
      const latestHistoryEntry = this.getLatestHistoryEntry(itemHistoryEntries);
      const isHistoryItem = isCpcaChecklistHistoryItem(definition.key);
      return {
        itemKey: definition.key,
        label: definition.label,
        shortLabel: definition.shortLabel,
        description: definition.description,
        requiresSpeakerName: definition.requiresSpeakerName,
        supportsHistory: isHistoryItem,
        isCompleted: isHistoryItem
          ? itemHistoryEntries.length > 0
          : Boolean(row?.isCompleted),
        completedAt: isHistoryItem
          ? (latestHistoryEntry?.completedAt?.toISOString() ?? null)
          : row?.completedAt
            ? row.completedAt.toISOString()
            : null,
        details: isHistoryItem
          ? (latestHistoryEntry?.details ?? null)
          : (row?.details ?? null),
        speakerName: isHistoryItem
          ? (latestHistoryEntry?.speakerName ?? null)
          : (row?.speakerName ?? null),
        historyCount: itemHistoryEntries.length,
        historyEntries: itemHistoryEntries.map((entry) => ({
          id: entry.id,
          completedAt: entry.completedAt.toISOString(),
          details: entry.details ?? null,
          speakerName: entry.speakerName ?? null,
          createdAt: entry.createdAt.toISOString(),
          updatedAt: entry.updatedAt.toISOString(),
        })),
        updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
      };
    });

    return {
      summary: this.buildChecklistSummary(items),
      items,
    };
  }

  private buildChecklistSummary(
    items: Array<{
      isCompleted: boolean;
      completedAt: string | null;
      updatedAt: string | null;
    }>,
  ) {
    const totalCount = items.length;
    const completedItems = items.filter((item) => item.isCompleted);
    const completedCount = completedItems.length;
    const pendingCount = totalCount - completedCount;
    const status: ChecklistStatus =
      completedCount === 0
        ? 'NOT_STARTED'
        : completedCount === totalCount
          ? 'COMPLETED'
          : 'IN_PROGRESS';

    const lastCompletedAt =
      completedItems
        .map((item) => item.completedAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null;
    const lastUpdatedAt =
      items
        .map((item) => item.updatedAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null;

    return {
      totalCount,
      completedCount,
      pendingCount,
      completionRate:
        totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
      status,
      statusLabel: this.getStatusLabel(status),
      lastCompletedAt,
      lastUpdatedAt,
    };
  }

  private buildNationalSummary(
    items: Array<{
      checklist: {
        summary: {
          status: ChecklistStatus;
        };
      };
    }>,
  ) {
    let completedCount = 0;
    let inProgressCount = 0;
    let notStartedCount = 0;

    for (const item of items) {
      if (item.checklist.summary.status === 'COMPLETED') {
        completedCount += 1;
        continue;
      }
      if (item.checklist.summary.status === 'IN_PROGRESS') {
        inProgressCount += 1;
        continue;
      }
      notStartedCount += 1;
    }

    return {
      totalCount: items.length,
      completedCount,
      inProgressCount,
      notStartedCount,
    };
  }

  private normalizeChecklistItems(rawItems: ChecklistUpdateInput['items']) {
    const items = Array.isArray(rawItems) ? rawItems : [];
    const normalized = items.map((item) => {
      const itemKey = String(item.itemKey ?? '')
        .trim()
        .toUpperCase();
      if (!isCpcaChecklistItemKey(itemKey)) {
        throwError('VALIDATION_ERROR', {
          field: 'itemKey',
          reason: 'INVALID_CPCA_CHECKLIST_ITEM',
          itemKey,
        });
      }

      if (isCpcaChecklistHistoryItem(itemKey)) {
        return {
          kind: 'HISTORY' as const,
          itemKey,
          historyEntries: this.normalizeChecklistHistoryEntries(
            itemKey,
            item.historyEntries,
            {
              isCompleted: Boolean(item.isCompleted),
              completedAt: item.completedAt,
              details: item.details,
              speakerName: item.speakerName,
            },
          ),
        };
      }

      const isCompleted = Boolean(item.isCompleted);
      const details = this.cleanOptionalText(item.details, 2000);
      const speakerName = this.cleanOptionalText(item.speakerName, 220);

      if (!isCompleted) {
        return {
          kind: 'BOOLEAN' as const,
          itemKey,
          isCompleted: false,
          completedAt: null as Date | null,
          details: null as string | null,
          speakerName: null as string | null,
        };
      }

      const completedAt = this.parseChecklistDate(item.completedAt, itemKey);

      if (isCpcaChecklistDirectEmailItem(itemKey) && !details) {
        throwError('VALIDATION_ERROR', {
          field: 'details',
          reason: 'CPCA_CHECKLIST_EMAIL_REQUIRED',
        });
      }
      if (isCpcaChecklistDirectEmailItem(itemKey) && details) {
        this.assertValidChecklistEmail(details);
      }
      if (isCpcaChecklistIntraerLinkItem(itemKey) && !details) {
        throwError('VALIDATION_ERROR', {
          field: 'details',
          reason: 'CPCA_CHECKLIST_INTRAER_URL_REQUIRED',
        });
      }
      if (isCpcaChecklistIntraerLinkItem(itemKey) && details) {
        this.assertValidChecklistUrl(details);
      }

      return {
        kind: 'BOOLEAN' as const,
        itemKey,
        isCompleted: true,
        completedAt,
        details,
        speakerName,
      };
    });

    const uniqueKeys = new Set(normalized.map((item) => item.itemKey));
    if (
      normalized.length !== CPCA_CHECKLIST_ITEM_KEYS.length ||
      uniqueKeys.size !== CPCA_CHECKLIST_ITEM_KEYS.length
    ) {
      throwError('VALIDATION_ERROR', {
        field: 'items',
        reason: 'CPCA_CHECKLIST_ITEMS_REQUIRED',
      });
    }

    for (const itemKey of CPCA_CHECKLIST_ITEM_KEYS) {
      if (!uniqueKeys.has(itemKey)) {
        throwError('VALIDATION_ERROR', {
          field: 'items',
          reason: 'CPCA_CHECKLIST_ITEMS_REQUIRED',
          itemKey,
        });
      }
    }

    return CPCA_CHECKLIST_ITEM_KEYS.map(
      (itemKey) => normalized.find((item) => item.itemKey === itemKey)!,
    );
  }

  private normalizeChecklistHistoryEntries(
    itemKey: CpcaChecklistItemKey,
    rawEntries:
      | Array<{
          id?: string | null;
          completedAt: string;
          details?: string | null;
          speakerName?: string | null;
        }>
      | null
      | undefined,
    fallback: {
      isCompleted: boolean;
      completedAt?: string | null;
      details?: string | null;
      speakerName?: string | null;
    },
  ) {
    const entries = Array.isArray(rawEntries) ? rawEntries : [];
    const normalizedEntries = entries.map((entry) =>
      this.normalizeSingleChecklistHistoryEntry(itemKey, {
        id: entry.id ?? null,
        completedAt: entry.completedAt,
        details: entry.details,
        speakerName: entry.speakerName,
      }),
    );

    if (normalizedEntries.length > 0) {
      return this.sortHistoryEntries(normalizedEntries);
    }

    if (!fallback.isCompleted) {
      return [] as ChecklistHistoryEntryDraft[];
    }

    return [
      this.normalizeSingleChecklistHistoryEntry(itemKey, {
        id: null,
        completedAt: fallback.completedAt,
        details: fallback.details,
        speakerName: fallback.speakerName,
      }),
    ];
  }

  private normalizeSingleChecklistHistoryEntry(
    itemKey: CpcaChecklistItemKey,
    entry: {
      id?: string | null;
      completedAt?: string | null;
      details?: string | null;
      speakerName?: string | null;
    },
  ) {
    const details = this.cleanOptionalText(entry.details, 2000);
    const speakerName = this.cleanOptionalText(entry.speakerName, 220);
    const completedAt = this.parseChecklistDate(entry.completedAt, itemKey);

    if (!details) {
      throwError('VALIDATION_ERROR', {
        field: 'details',
        reason:
          itemKey === 'PALESTRA'
            ? 'CPCA_CHECKLIST_PALESTRA_DETAILS_REQUIRED'
            : 'CPCA_CHECKLIST_HISTORY_DETAILS_REQUIRED',
        itemKey,
      });
    }

    if (itemKey === 'PALESTRA' && !speakerName) {
      throwError('VALIDATION_ERROR', {
        field: 'speakerName',
        reason: 'CPCA_CHECKLIST_PALESTRA_SPEAKER_REQUIRED',
      });
    }

    return {
      id: String(entry.id ?? '').trim() || null,
      completedAt,
      details,
      speakerName: itemKey === 'PALESTRA' ? speakerName : null,
    };
  }

  private async syncHistoryEntriesForItem(
    tx: any,
    localityId: string,
    itemKey: CpcaChecklistItemKey,
    actorUserId: string,
    existingEntries: Array<{
      id: string;
      itemKey: string;
      completedAt: Date;
      details: string | null;
      speakerName: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>,
    payloadEntries: ChecklistHistoryEntryDraft[],
  ) {
    const existingById = new Map(
      existingEntries.map((entry) => [entry.id, entry] as const),
    );
    const updatedEntries = [...existingEntries];

    for (const entry of payloadEntries) {
      if (entry.id && existingById.has(entry.id)) {
        const current = existingById.get(entry.id)!;
        await tx.cpcaChecklistHistoryEntry.update({
          where: { id: entry.id },
          data: {
            completedAt: entry.completedAt,
            details: entry.details,
            speakerName: entry.speakerName,
          },
        });
        const index = updatedEntries.findIndex((item) => item.id === entry.id);
        if (index >= 0) {
          updatedEntries[index] = {
            ...current,
            completedAt: entry.completedAt,
            details: entry.details,
            speakerName: entry.speakerName,
            updatedAt: new Date(),
          };
        }
        continue;
      }

      const matchingExistingEntry = updatedEntries.find(
        (current) =>
          current.completedAt.getTime() === entry.completedAt.getTime() &&
          String(current.details ?? '') === String(entry.details ?? '') &&
          String(current.speakerName ?? '') === String(entry.speakerName ?? ''),
      );
      if (matchingExistingEntry) {
        continue;
      }

      const created = await tx.cpcaChecklistHistoryEntry.create({
        data: {
          omId: localityId,
          itemKey,
          completedAt: entry.completedAt,
          details: entry.details,
          speakerName: entry.speakerName,
          createdByUserId: actorUserId,
        },
        select: {
          id: true,
          itemKey: true,
          completedAt: true,
          details: true,
          speakerName: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      updatedEntries.push(created);
    }

    return this.sortHistoryEntries(updatedEntries);
  }

  private sortHistoryEntries<
    T extends {
      completedAt: Date;
      createdAt?: Date;
    },
  >(entries: T[]) {
    return [...entries].sort((left, right) => {
      const completedDiff =
        right.completedAt.getTime() - left.completedAt.getTime();
      if (completedDiff !== 0) return completedDiff;
      return (
        (right.createdAt?.getTime() ?? 0) - (left.createdAt?.getTime() ?? 0)
      );
    });
  }

  private getLatestHistoryEntry<
    T extends {
      completedAt: Date;
      createdAt?: Date;
    },
  >(entries: T[]) {
    return this.sortHistoryEntries(entries).at(0) ?? null;
  }

  private parseChecklistDate(
    value: string | null | undefined,
    itemKey: CpcaChecklistItemKey,
  ) {
    const raw = String(value ?? '').trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      throwError('VALIDATION_ERROR', {
        field: 'completedAt',
        reason: 'INVALID_CPCA_CHECKLIST_DATE',
        itemKey,
      });
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throwError('VALIDATION_ERROR', {
        field: 'completedAt',
        reason: 'INVALID_CPCA_CHECKLIST_DATE',
        itemKey,
      });
    }

    return parsed;
  }

  private cleanOptionalText(
    value: string | null | undefined,
    maxLength: number,
  ) {
    const sanitized = sanitizeText(String(value ?? '').trim());
    if (!sanitized) return null;
    return sanitized.slice(0, maxLength);
  }

  private assertValidChecklistEmail(value: string) {
    const normalized = String(value ?? '')
      .trim()
      .toLowerCase();
    const emailPattern =
      /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;

    if (!emailPattern.test(normalized)) {
      throwError('VALIDATION_ERROR', {
        field: 'details',
        reason: 'INVALID_CPCA_CHECKLIST_EMAIL',
      });
    }
  }

  private assertValidChecklistUrl(value: string) {
    const raw = String(value ?? '').trim();
    const candidate = /^[a-z][a-z\d+\-.]*:\/\//i.test(raw)
      ? raw
      : `https://${raw}`;

    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      throwError('VALIDATION_ERROR', {
        field: 'details',
        reason: 'INVALID_CPCA_CHECKLIST_URL',
      });
    }

    const protocol = parsed.protocol.toLowerCase();
    if (
      (protocol !== 'http:' && protocol !== 'https:') ||
      !parsed.hostname ||
      /\s/.test(raw)
    ) {
      throwError('VALIDATION_ERROR', {
        field: 'details',
        reason: 'INVALID_CPCA_CHECKLIST_URL',
      });
    }
  }

  private normalizeStatusFilter(value: string | null | undefined) {
    const normalized = String(value ?? '')
      .trim()
      .toUpperCase();
    if (
      normalized === 'NOT_STARTED' ||
      normalized === 'IN_PROGRESS' ||
      normalized === 'COMPLETED'
    ) {
      return normalized as ChecklistStatus;
    }
    return 'ALL';
  }

  private getStatusLabel(status: ChecklistStatus) {
    if (status === 'COMPLETED') return 'Concluído';
    if (status === 'IN_PROGRESS') return 'Em andamento';
    return 'Não iniciado';
  }

  private async resolveLocalityIdForView(
    user: RbacUser | undefined,
    requestedLocalityId?: string,
  ) {
    const requested = String(requestedLocalityId ?? '').trim();
    if (this.canViewAnyLocality(user)) {
      if (requested) return requested;
      const firstLocality = await this.prisma.om.findFirst({
        where: { hasCpca: true },
        select: { id: true },
        orderBy: { name: 'asc' },
      });
      const localityId = String(firstLocality?.id ?? '').trim();
      if (!localityId) {
        throwError('NOT_FOUND');
      }
      return localityId;
    }

    const userLocalityId = String(user?.omId ?? '').trim();
    if (!userLocalityId) {
      throwError('RBAC_FORBIDDEN');
    }
    if (requested && requested !== userLocalityId) {
      throwError('RBAC_FORBIDDEN');
    }
    return userLocalityId;
  }

  private async resolveLocalityIdForUpdate(
    user: RbacUser | undefined,
    requestedLocalityId?: string,
  ) {
    const requested = String(requestedLocalityId ?? '').trim();
    const userLocalityId = String(user?.omId ?? '').trim();

    if (requested && userLocalityId && requested !== userLocalityId) {
      throwError('RBAC_FORBIDDEN');
    }

    const localityId = requested || userLocalityId;
    if (!localityId) {
      throwError('RBAC_FORBIDDEN');
    }
    return localityId;
  }

  private canViewAnyLocality(user: RbacUser | undefined) {
    return hasPermission(user, 'cpca_cases', 'view', 'NATIONAL');
  }

  private assertCanViewNationalChecklist(user: RbacUser | undefined) {
    if (!hasPermission(user, 'cpca_checklist', 'view', 'NATIONAL')) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private async assertOmSupportsCpca(localityId: string) {
    const locality = await this.prisma.om.findUnique({
      where: { id: localityId },
      select: {
        id: true,
        code: true,
        name: true,
        uf: true,
        hasCpca: true,
      },
    });

    if (!locality) {
      throwError('NOT_FOUND');
    }

    if (!locality.hasCpca) {
      throwError('VALIDATION_ERROR', {
        reason: 'CPCA_NOT_ENABLED_FOR_LOCALITY',
      });
    }

    return locality;
  }

  private requireUserId(user: RbacUser | undefined) {
    const userId = String(user?.id ?? '').trim();
    if (!userId) {
      throwError('RBAC_FORBIDDEN');
    }
    return userId;
  }

  private async isPresidentUser(userId: string, localityId: string) {
    const president = await this.prisma.cpcaCommissionPresident.findFirst({
      where: {
        omId: localityId,
        userId,
      },
      select: { id: true },
    });

    return Boolean(president);
  }

  private async assertPresidentUser(userId: string, localityId: string) {
    const isPresident = await this.isPresidentUser(userId, localityId);
    if (!isPresident) {
      throwError('RBAC_FORBIDDEN');
    }
  }
}
