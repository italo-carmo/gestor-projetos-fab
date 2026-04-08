import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { throwError } from '../common/http-error';
import type { RbacUser } from '../rbac/rbac.types';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

const MENU_UPDATE_RESOURCES: Record<string, readonly string[]> = {
  activities: ['activities', 'activity_comments'],
  smif_complaints: ['smif_complaints'],
  gsd_recruits: ['localities'],
  elos: ['elos'],
  best_practices: ['best_practices', 'best_practice_types'],
  tasks: ['task_instances', 'task_comments'],
  meetings: ['meetings'],
  org_chart: ['org_chart'],
  missions: ['missions'],
  notices: ['notices'],
  social_communication: [
    'social_communication',
    'social_communication_highlight',
  ],
  library: ['library'],
  cpca_cases: ['cpca_cases'],
  bi: ['bi', 'bi_survey'],
  admin_rbac: ['admin_rbac', 'roles', 'users'],
  admin_catalog: ['specialties', 'postos', 'phases', 'elo_roles'],
  admin_oms: ['localities'],
};

const IGNORED_AUDIT_ACTIONS = ['view', 'list', 'read', 'query', 'search'];

@Injectable()
export class MenuUpdatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(rawMenuKeys: string | string[] | undefined, user?: RbacUser) {
    const userId = this.requireUserId(user);
    const menuKeys = this.normalizeMenuKeys(rawMenuKeys);
    if (!menuKeys.length) {
      return { items: [] as Array<Record<string, unknown>> };
    }

    const menuResourcePairs = menuKeys.flatMap((menuKey) =>
      Array.from(new Set(MENU_UPDATE_RESOURCES[menuKey] ?? [])).map(
        (resource) => ({
          menuKey,
          resource,
        }),
      ),
    );

    const [aggregateRows, seenRows] = await Promise.all([
      menuResourcePairs.length
        ? this.prisma.$queryRaw<
            Array<{
              menuKey: string;
              unreadCount: bigint | number | string | null;
              lastEventAt: Date | null;
            }>
          >(Prisma.sql`
            WITH "menu_resources" ("menuKey", "resource") AS (
              VALUES ${Prisma.join(
                menuResourcePairs.map((pair) =>
                  Prisma.sql`(${pair.menuKey}, ${pair.resource})`,
                ),
              )}
            ),
            "seen_by_menu" AS (
              SELECT "menuKey", "seenAt"
              FROM "UserMenuUpdateRead"
              WHERE "userId" = ${userId}
                AND "menuKey" IN (${Prisma.join(menuKeys)})
            ),
            "candidate_logs" AS (
              SELECT
                mr."menuKey" AS "menuKey",
                al."resource" AS "resource",
                al."entityId" AS "entityId",
                al."diffJson" AS "diffJson",
                al."createdAt" AS "createdAt"
              FROM "menu_resources" mr
              LEFT JOIN "seen_by_menu" sbm
                ON sbm."menuKey" = mr."menuKey"
              JOIN "AuditLog" al
                ON al."resource" = mr."resource"
               AND al."action" NOT IN (${Prisma.join(IGNORED_AUDIT_ACTIONS)})
               AND (
                 sbm."seenAt" IS NULL OR al."createdAt" > sbm."seenAt"
               )
            ),
            "direct_items" AS (
              SELECT
                cl."menuKey" AS "menuKey",
                cl."createdAt" AS "createdAt",
                CASE
                  WHEN cl."resource" = 'activity_comments'
                    THEN COALESCE(cl."diffJson"->>'activityId', cl."entityId")
                  WHEN cl."resource" = 'task_comments'
                    THEN COALESCE(cl."diffJson"->>'taskInstanceId', cl."entityId")
                  WHEN cl."resource" = 'activities' AND cl."diffJson" ? 'activityId'
                    THEN cl."diffJson"->>'activityId'
                  WHEN cl."resource" = 'task_instances' AND cl."diffJson" ? 'taskInstanceId'
                    THEN cl."diffJson"->>'taskInstanceId'
                  ELSE cl."entityId"
                END AS "itemKey"
              FROM "candidate_logs" cl
            ),
            "array_items" AS (
              SELECT
                cl."menuKey" AS "menuKey",
                cl."createdAt" AS "createdAt",
                jsonb_array_elements_text(
                  CASE
                    WHEN jsonb_typeof(cl."diffJson"->'ids') = 'array'
                      THEN cl."diffJson"->'ids'
                    ELSE '[]'::jsonb
                  END
                ) AS "itemKey"
              FROM "candidate_logs" cl
            ),
            "all_items" AS (
              SELECT
                di."menuKey" AS "menuKey",
                di."createdAt" AS "createdAt",
                btrim(di."itemKey") AS "itemKey"
              FROM "direct_items" di
              WHERE btrim(COALESCE(di."itemKey", '')) <> ''
              UNION ALL
              SELECT
                ai."menuKey" AS "menuKey",
                ai."createdAt" AS "createdAt",
                btrim(ai."itemKey") AS "itemKey"
              FROM "array_items" ai
              WHERE btrim(COALESCE(ai."itemKey", '')) <> ''
            ),
            "menu_unread" AS (
              SELECT
                i."menuKey" AS "menuKey",
                COUNT(DISTINCT i."itemKey") AS "unreadCount",
                MAX(i."createdAt") AS "lastEventAt"
              FROM "all_items" i
              GROUP BY i."menuKey"
            )
            SELECT
              mk."menuKey" AS "menuKey",
              COALESCE(mu."unreadCount", 0) AS "unreadCount",
              mu."lastEventAt" AS "lastEventAt"
            FROM (
              VALUES ${Prisma.join(
                menuKeys.map((menuKey) => Prisma.sql`(${menuKey})`),
              )}
            ) AS mk("menuKey")
            LEFT JOIN "menu_unread" mu
              ON mu."menuKey" = mk."menuKey"
          `)
        : Promise.resolve([]),
      this.prisma.$queryRaw<Array<{ menuKey: string; seenAt: Date }>>(
        Prisma.sql`
          SELECT "menuKey", "seenAt"
          FROM "UserMenuUpdateRead"
          WHERE "userId" = ${userId}
            AND "menuKey" IN (${Prisma.join(menuKeys)})
        `,
      ),
    ]);

    const aggregatesByMenuKey = new Map<
      string,
      { unreadCount: number; lastEventAt: Date | null }
    >();
    for (const row of aggregateRows) {
      aggregatesByMenuKey.set(row.menuKey, {
        unreadCount: this.toUnreadCount(row.unreadCount),
        lastEventAt: row.lastEventAt ?? null,
      });
    }

    const seenAtByMenuKey = new Map<string, Date>();
    for (const row of seenRows) {
      seenAtByMenuKey.set(row.menuKey, row.seenAt);
    }

    const items = menuKeys.map((menuKey) => {
      const aggregate = aggregatesByMenuKey.get(menuKey);
      const unreadCount = aggregate?.unreadCount ?? 0;
      const lastEventAt = aggregate?.lastEventAt ?? null;
      const seenAt = seenAtByMenuKey.get(menuKey) ?? null;
      const hasUnread = unreadCount > 0;

      return {
        menuKey,
        unreadCount,
        hasUnread,
        lastEventAt: lastEventAt ? lastEventAt.toISOString() : null,
        seenAt: seenAt ? seenAt.toISOString() : null,
      };
    });

    return { items };
  }

  async markSeen(menuKeyRaw: string, user?: RbacUser) {
    const userId = this.requireUserId(user);
    const menuKey = String(menuKeyRaw ?? '').trim();

    if (!menuKey || !Object.prototype.hasOwnProperty.call(MENU_UPDATE_RESOURCES, menuKey)) {
      throwError('VALIDATION_ERROR', {
        field: 'menuKey',
        reason: 'INVALID_MENU_KEY',
      });
    }

    const seenAt = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "UserMenuUpdateRead" (
          "id",
          "userId",
          "menuKey",
          "seenAt",
          "updatedAt"
        )
        VALUES (
          ${randomUUID()},
          ${userId},
          ${menuKey},
          ${seenAt},
          ${seenAt}
        )
        ON CONFLICT ("userId", "menuKey")
        DO UPDATE
        SET
          "seenAt" = EXCLUDED."seenAt",
          "updatedAt" = EXCLUDED."updatedAt"
      `,
    );

    return {
      ok: true,
      menuKey,
      seenAt: seenAt.toISOString(),
    };
  }

  private toUnreadCount(value: bigint | number | string | null | undefined) {
    if (value === null || value === undefined) return 0;

    if (typeof value === 'bigint') {
      if (value <= 0n) return 0;
      const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
      return Number(value > maxSafe ? maxSafe : value);
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value) || value <= 0) return 0;
      return Math.floor(value);
    }

    if (typeof value === 'string') {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) return 0;
      return parsed;
    }

    return 0;
  }

  private normalizeMenuKeys(rawMenuKeys: string | string[] | undefined) {
    const defaultKeys = Object.keys(MENU_UPDATE_RESOURCES).sort((a, b) =>
      a.localeCompare(b, 'pt-BR'),
    );

    if (rawMenuKeys === undefined) {
      return defaultKeys;
    }

    const tokens = (Array.isArray(rawMenuKeys) ? rawMenuKeys : [rawMenuKeys])
      .flatMap((value) => String(value ?? '').split(','))
      .map((value) => value.trim())
      .filter(Boolean);

    const deduped = Array.from(new Set(tokens));
    const invalid = deduped.filter(
      (menuKey) =>
        !Object.prototype.hasOwnProperty.call(MENU_UPDATE_RESOURCES, menuKey),
    );

    if (invalid.length > 0) {
      throwError('VALIDATION_ERROR', {
        field: 'menuKeys',
        reason: 'INVALID_MENU_KEYS',
        invalid,
      });
    }

    return deduped.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  private requireUserId(user?: RbacUser) {
    const userId = String(user?.id ?? '').trim();
    if (!userId) {
      throwError('RBAC_FORBIDDEN');
    }
    return userId;
  }
}
