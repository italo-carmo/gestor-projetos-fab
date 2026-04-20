import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { throwError } from '../common/http-error';
import type { RbacUser } from '../rbac/rbac.types';
import {
  normalizeRoleName,
  ROLE_COMANDANTE_COMGEP,
  ROLE_TI,
} from '../rbac/role-access';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

const MENU_UPDATE_RESOURCES: Record<string, readonly string[]> = {
  activities_smif: ['activities', 'activity_comments'],
  activities_cipavd: ['activities', 'activity_comments'],
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
  cpca_dashboard: [],
  cpca_cases: ['cpca_cases'],
  cpca_commission: ['cpca_cases'],
  cpca_president_approvals: [],
  bi: ['bi', 'bi_survey'],
  admin_rbac: ['admin_rbac', 'roles', 'users'],
  admin_catalog: [
    'specialties',
    'postos',
    'phases',
    'elo_roles',
    'localities_cipavd',
  ],
  admin_oms: ['localities'],
};

const IGNORED_AUDIT_ACTIONS = ['view', 'list', 'read', 'query', 'search'];
const CPCA_APPROVAL_ROLE_NAMES = new Set([
  normalizeRoleName(ROLE_TI),
  normalizeRoleName(ROLE_COMANDANTE_COMGEP),
]);

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

    const shouldTrackCpcaApprovals = menuKeys.includes(
      'cpca_president_approvals',
    );
    const [aggregateRows, seenRows, pendingCpcaApprovals] = await Promise.all([
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
                menuResourcePairs.map(
                  (pair) => Prisma.sql`(${pair.menuKey}, ${pair.resource})`,
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
                al."createdAt" AS "createdAt",
                "al_comment"."activityId" AS "commentActivityId",
                "al_sched"."activityId" AS "scheduleActivityId"
              FROM "menu_resources" mr
              LEFT JOIN "seen_by_menu" sbm
                ON sbm."menuKey" = mr."menuKey"
              JOIN "AuditLog" al
                ON al."resource" = mr."resource"
               AND al."action" NOT IN (${Prisma.join(IGNORED_AUDIT_ACTIONS)})
               AND (
                 sbm."seenAt" IS NULL OR al."createdAt" > sbm."seenAt"
               )
              LEFT JOIN "ActivityComment" "al_comment"
                ON al."resource" = 'activity_comments'
               AND "al_comment"."id" = al."entityId"
              LEFT JOIN "ActivityVisitScheduleItem" "al_sched"
                ON al."resource" = 'activities'
               AND "al_sched"."id" = al."entityId"
              LEFT JOIN "Activity" "act_scope"
                ON (
                  (al."resource" = 'activities' AND "act_scope"."id" = al."entityId")
                  OR (
                    al."resource" = 'activities'
                    AND "al_sched"."id" IS NOT NULL
                    AND "act_scope"."id" = "al_sched"."activityId"
                  )
                  OR (
                    al."resource" = 'activity_comments'
                    AND "act_scope"."id" = COALESCE(
                      NULLIF(btrim(al."diffJson"->>'activityId'), ''),
                      "al_comment"."activityId"
                    )
                  )
                )
              WHERE (
                (
                  mr."menuKey" NOT IN (
                    'activities_smif',
                    'activities_cipavd',
                    'cpca_cases',
                    'cpca_commission'
                  )
                  OR (
                    "act_scope"."id" IS NOT NULL
                    AND (
                      (mr."menuKey" = 'activities_smif' AND "act_scope"."scope" = 'SMIF'::"ActivityScope")
                      OR (mr."menuKey" = 'activities_cipavd' AND "act_scope"."scope" = 'CIPAVD'::"ActivityScope")
                    )
                  )
                  OR (
                    mr."menuKey" = 'cpca_cases'
                    AND al."action" NOT LIKE 'cpca_commission_%'
                    AND al."action" NOT LIKE 'cpca_president_%'
                  )
                  OR (
                    mr."menuKey" = 'cpca_commission'
                    AND al."action" LIKE 'cpca_commission_%'
                  )
                )
              )
            ),
            "direct_items" AS (
              SELECT
                cl."menuKey" AS "menuKey",
                cl."createdAt" AS "createdAt",
                CASE
                  WHEN cl."resource" = 'activity_comments'
                    THEN COALESCE(
                      NULLIF(btrim(cl."diffJson"->>'activityId'), ''),
                      NULLIF(btrim(cl."commentActivityId"), '')
                    )
                  WHEN cl."resource" = 'task_comments'
                    THEN COALESCE(cl."diffJson"->>'taskInstanceId', cl."entityId")
                  WHEN cl."resource" = 'activities' AND cl."diffJson" ? 'activityId'
                    THEN NULLIF(btrim(cl."diffJson"->>'activityId'), '')
                  WHEN cl."resource" = 'activities'
                    AND cl."scheduleActivityId" IS NOT NULL
                    THEN NULLIF(btrim(cl."scheduleActivityId"), '')
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
      shouldTrackCpcaApprovals && this.isCpcaApprovalsManager(user)
        ? Promise.all([
            this.prisma.cpcaPresidentSelfRegistration.count({
              where: { status: 'PENDING' },
            }),
            this.prisma.cpcaPresidentNominationRequest.count({
              where: { status: 'PENDING' },
            }),
            this.prisma.cpcaCommissionCoverageRequest.count({
              where: { status: 'PENDING' },
            }),
          ]).then((counts: number[]) =>
            counts.reduce((sum: number, value: number) => sum + value, 0),
          )
        : Promise.resolve(0),
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
      const cpcaApprovalUnreadCount =
        menuKey === 'cpca_president_approvals' ? pendingCpcaApprovals : null;
      const aggregate = aggregatesByMenuKey.get(menuKey);
      const unreadCount =
        cpcaApprovalUnreadCount !== null
          ? cpcaApprovalUnreadCount
          : (aggregate?.unreadCount ?? 0);
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

    if (
      !menuKey ||
      !Object.prototype.hasOwnProperty.call(MENU_UPDATE_RESOURCES, menuKey)
    ) {
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

  private isCpcaApprovalsManager(user?: RbacUser) {
    const roleNames = new Set(
      [...(user?.roles ?? []), ...(user?.allRoles ?? [])].map((role) =>
        normalizeRoleName(role.name),
      ),
    );
    for (const roleName of CPCA_APPROVAL_ROLE_NAMES) {
      if (roleNames.has(roleName)) {
        return true;
      }
    }
    return false;
  }
}
