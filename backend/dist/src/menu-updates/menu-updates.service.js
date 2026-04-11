"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MenuUpdatesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const http_error_1 = require("../common/http-error");
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const MENU_UPDATE_RESOURCES = {
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
    cpca_cases: ['cpca_cases'],
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
let MenuUpdatesService = class MenuUpdatesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(rawMenuKeys, user) {
        const userId = this.requireUserId(user);
        const menuKeys = this.normalizeMenuKeys(rawMenuKeys);
        if (!menuKeys.length) {
            return { items: [] };
        }
        const menuResourcePairs = menuKeys.flatMap((menuKey) => Array.from(new Set(MENU_UPDATE_RESOURCES[menuKey] ?? [])).map((resource) => ({
            menuKey,
            resource,
        })));
        const [aggregateRows, seenRows] = await Promise.all([
            menuResourcePairs.length
                ? this.prisma.$queryRaw(client_1.Prisma.sql `
            WITH "menu_resources" ("menuKey", "resource") AS (
              VALUES ${client_1.Prisma.join(menuResourcePairs.map((pair) => client_1.Prisma.sql `(${pair.menuKey}, ${pair.resource})`))}
            ),
            "seen_by_menu" AS (
              SELECT "menuKey", "seenAt"
              FROM "UserMenuUpdateRead"
              WHERE "userId" = ${userId}
                AND "menuKey" IN (${client_1.Prisma.join(menuKeys)})
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
               AND al."action" NOT IN (${client_1.Prisma.join(IGNORED_AUDIT_ACTIONS)})
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
                mr."menuKey" NOT IN ('activities_smif', 'activities_cipavd')
                OR (
                  "act_scope"."id" IS NOT NULL
                  AND (
                    (mr."menuKey" = 'activities_smif' AND "act_scope"."scope" = 'SMIF'::"ActivityScope")
                    OR (mr."menuKey" = 'activities_cipavd' AND "act_scope"."scope" = 'CIPAVD'::"ActivityScope")
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
              VALUES ${client_1.Prisma.join(menuKeys.map((menuKey) => client_1.Prisma.sql `(${menuKey})`))}
            ) AS mk("menuKey")
            LEFT JOIN "menu_unread" mu
              ON mu."menuKey" = mk."menuKey"
          `)
                : Promise.resolve([]),
            this.prisma.$queryRaw(client_1.Prisma.sql `
          SELECT "menuKey", "seenAt"
          FROM "UserMenuUpdateRead"
          WHERE "userId" = ${userId}
            AND "menuKey" IN (${client_1.Prisma.join(menuKeys)})
        `),
        ]);
        const aggregatesByMenuKey = new Map();
        for (const row of aggregateRows) {
            aggregatesByMenuKey.set(row.menuKey, {
                unreadCount: this.toUnreadCount(row.unreadCount),
                lastEventAt: row.lastEventAt ?? null,
            });
        }
        const seenAtByMenuKey = new Map();
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
    async markSeen(menuKeyRaw, user) {
        const userId = this.requireUserId(user);
        const menuKey = String(menuKeyRaw ?? '').trim();
        if (!menuKey || !Object.prototype.hasOwnProperty.call(MENU_UPDATE_RESOURCES, menuKey)) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'menuKey',
                reason: 'INVALID_MENU_KEY',
            });
        }
        const seenAt = new Date();
        await this.prisma.$executeRaw(client_1.Prisma.sql `
        INSERT INTO "UserMenuUpdateRead" (
          "id",
          "userId",
          "menuKey",
          "seenAt",
          "updatedAt"
        )
        VALUES (
          ${(0, crypto_1.randomUUID)()},
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
      `);
        return {
            ok: true,
            menuKey,
            seenAt: seenAt.toISOString(),
        };
    }
    toUnreadCount(value) {
        if (value === null || value === undefined)
            return 0;
        if (typeof value === 'bigint') {
            if (value <= 0n)
                return 0;
            const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
            return Number(value > maxSafe ? maxSafe : value);
        }
        if (typeof value === 'number') {
            if (!Number.isFinite(value) || value <= 0)
                return 0;
            return Math.floor(value);
        }
        if (typeof value === 'string') {
            const parsed = Number.parseInt(value, 10);
            if (!Number.isFinite(parsed) || parsed <= 0)
                return 0;
            return parsed;
        }
        return 0;
    }
    normalizeMenuKeys(rawMenuKeys) {
        const defaultKeys = Object.keys(MENU_UPDATE_RESOURCES).sort((a, b) => a.localeCompare(b, 'pt-BR'));
        if (rawMenuKeys === undefined) {
            return defaultKeys;
        }
        const tokens = (Array.isArray(rawMenuKeys) ? rawMenuKeys : [rawMenuKeys])
            .flatMap((value) => String(value ?? '').split(','))
            .map((value) => value.trim())
            .filter(Boolean);
        const deduped = Array.from(new Set(tokens));
        const invalid = deduped.filter((menuKey) => !Object.prototype.hasOwnProperty.call(MENU_UPDATE_RESOURCES, menuKey));
        if (invalid.length > 0) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'menuKeys',
                reason: 'INVALID_MENU_KEYS',
                invalid,
            });
        }
        return deduped.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }
    requireUserId(user) {
        const userId = String(user?.id ?? '').trim();
        if (!userId) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
        return userId;
    }
};
exports.MenuUpdatesService = MenuUpdatesService;
exports.MenuUpdatesService = MenuUpdatesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MenuUpdatesService);
//# sourceMappingURL=menu-updates.service.js.map