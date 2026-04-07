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

    const resources = Array.from(
      new Set(
        menuKeys.flatMap(
          (menuKey) => MENU_UPDATE_RESOURCES[menuKey] ?? [],
        ),
      ),
    );

    const [latestAuditByResource, seenRows] = await Promise.all([
      resources.length
        ? this.prisma.auditLog.groupBy({
            by: ['resource'],
            where: {
              resource: { in: resources },
              action: { notIn: IGNORED_AUDIT_ACTIONS },
            },
            orderBy: { resource: 'asc' },
            _max: { createdAt: true },
          })
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

    const lastEventAtByResource = new Map<string, Date>();
    for (const row of latestAuditByResource) {
      if (row._max.createdAt instanceof Date) {
        lastEventAtByResource.set(row.resource, row._max.createdAt);
      }
    }

    const seenAtByMenuKey = new Map<string, Date>();
    for (const row of seenRows) {
      seenAtByMenuKey.set(row.menuKey, row.seenAt);
    }

    const items = menuKeys.map((menuKey) => {
      const lastEventAt = this.resolveLastEventAt(menuKey, lastEventAtByResource);
      const seenAt = seenAtByMenuKey.get(menuKey) ?? null;
      const hasUnread =
        lastEventAt instanceof Date &&
        (!seenAt || lastEventAt.getTime() > seenAt.getTime());

      return {
        menuKey,
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

  private resolveLastEventAt(
    menuKey: string,
    byResource: Map<string, Date>,
  ) {
    const resources = MENU_UPDATE_RESOURCES[menuKey] ?? [];
    let latest: Date | null = null;

    for (const resource of resources) {
      const candidate = byResource.get(resource);
      if (!(candidate instanceof Date)) continue;
      if (!latest || candidate.getTime() > latest.getTime()) {
        latest = candidate;
      }
    }

    return latest;
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
