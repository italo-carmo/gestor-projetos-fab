import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RbacUser } from '../rbac/rbac.types';
import { throwError } from '../common/http-error';
import { sanitizeText } from '../common/sanitize';
import { AuditService } from '../audit/audit.service';
import { parsePagination } from '../common/pagination';
import { isNationalCommissionMember } from '../rbac/role-access';

@Injectable()
export class ElosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(filters: { localityId?: string; roleType?: string; eloRoleId?: string; page?: string; pageSize?: string }, user?: RbacUser) {
    const where: Prisma.EloWhereInput = {};
    if (filters.localityId) where.localityId = filters.localityId;
    if (filters.eloRoleId) where.eloRoleId = filters.eloRoleId;
    if (filters.roleType) where.eloRole = { code: filters.roleType };

    const constraints = this.getScopeConstraints(user);
    if (constraints.localityId) where.localityId = constraints.localityId;

    const { page, pageSize, skip, take } = parsePagination(filters.page, filters.pageSize);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.elo.findMany({
        where,
        include: { locality: true, eloRole: true },
        orderBy: [{ locality: { name: 'asc' } }, { eloRole: { sortOrder: 'asc' } }],
        skip,
        take,
      }),
      this.prisma.elo.count({ where }),
    ]);

    return {
      items: items.map((item) => this.mapElo(item, user?.executiveHidePii)),
      page,
      pageSize,
      total,
      executive_hide_pii: user?.executiveHidePii ?? false,
    };
  }

  async create(payload: {
    localityId: string;
    eloRoleId: string;
    name: string;
    userId?: string;
    rank?: string | null;
    phone?: string | null;
    email?: string | null;
    om?: string | null;
  }, user?: RbacUser) {
    this.assertConstraints(payload.localityId, user);
    const linkedUser = payload.userId
      ? await this.assertUserMatchesAssignment(payload.userId, payload.localityId, payload.eloRoleId)
      : null;

    const nameFromPayload = String(payload.name ?? '').trim();
    const resolvedName = linkedUser?.name ?? nameFromPayload;
    if (!resolvedName) {
      throwError('VALIDATION_ERROR', { reason: 'NAME_REQUIRED' });
    }

    const created = await this.prisma.elo.create({
      data: {
        localityId: payload.localityId,
        eloRoleId: payload.eloRoleId,
        name: sanitizeText(resolvedName),
        rank: payload.rank ? sanitizeText(payload.rank) : null,
        phone: payload.phone ? sanitizeText(payload.phone) : null,
        email: linkedUser?.email ?? (payload.email ? sanitizeText(payload.email) : null),
        om: payload.om ? sanitizeText(payload.om) : null,
      },
      include: { locality: true, eloRole: true },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'elos',
      action: 'create',
      entityId: created.id,
      localityId: created.localityId,
      diffJson: { eloRoleId: created.eloRoleId, name: created.name },
    });

    return this.mapElo(created, user?.executiveHidePii);
  }

  async update(id: string, payload: {
    localityId?: string;
    eloRoleId?: string;
    name?: string;
    userId?: string;
    rank?: string | null;
    phone?: string | null;
    email?: string | null;
    om?: string | null;
  }, user?: RbacUser) {
    const existing = await this.prisma.elo.findUnique({ where: { id } });
    if (!existing) throwError('NOT_FOUND');

    const localityId = payload.localityId ?? existing.localityId;
    const eloRoleId = payload.eloRoleId ?? existing.eloRoleId;
    this.assertConstraints(localityId, user);
    const linkedUser = payload.userId
      ? await this.assertUserMatchesAssignment(payload.userId, localityId, eloRoleId)
      : null;

    const resolvedName = linkedUser
      ? linkedUser.name
      : payload.name
        ? sanitizeText(payload.name)
        : undefined;
    const resolvedEmail = linkedUser
      ? linkedUser.email
      : payload.email
        ? sanitizeText(payload.email)
        : payload.email === null
          ? null
          : undefined;

    const updated = await this.prisma.elo.update({
      where: { id },
      data: {
        localityId,
        eloRoleId: payload.eloRoleId ?? undefined,
        name: resolvedName,
        rank: payload.rank ? sanitizeText(payload.rank) : payload.rank === null ? null : undefined,
        phone: payload.phone ? sanitizeText(payload.phone) : payload.phone === null ? null : undefined,
        email: resolvedEmail,
        om: payload.om ? sanitizeText(payload.om) : payload.om === null ? null : undefined,
      },
      include: { locality: true, eloRole: true },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'elos',
      action: 'update',
      entityId: id,
      localityId: updated.localityId,
    });

    return this.mapElo(updated, user?.executiveHidePii);
  }

  async remove(id: string, user?: RbacUser) {
    const existing = await this.prisma.elo.findUnique({ where: { id } });
    if (!existing) throwError('NOT_FOUND');
    this.assertConstraints(existing.localityId, user);
    await this.prisma.elo.delete({ where: { id } });

    await this.audit.log({
      userId: user?.id,
      resource: 'elos',
      action: 'delete',
      entityId: id,
      localityId: existing.localityId,
    });

    return { ok: true };
  }

  async orgChart(filters: { localityId?: string; roleType?: string; eloRoleId?: string }, user?: RbacUser) {
    const where: Prisma.EloWhereInput = {};
    if (filters.localityId) where.localityId = filters.localityId;
    if (filters.eloRoleId) where.eloRoleId = filters.eloRoleId;
    if (filters.roleType) where.eloRole = { code: filters.roleType };

    const constraints = this.getScopeConstraints(user);
    if (constraints.localityId) where.localityId = constraints.localityId;

    const userWhere: Prisma.UserWhereInput = {
      isActive: true,
      localityId: { not: null },
      eloRoleId: { not: null },
    };
    if (filters.localityId) userWhere.localityId = filters.localityId;
    if (filters.eloRoleId) userWhere.eloRoleId = filters.eloRoleId;
    if (filters.roleType) userWhere.eloRole = { code: filters.roleType };
    if (constraints.localityId) userWhere.localityId = constraints.localityId;

    const [items, candidates] = await this.prisma.$transaction([
      this.prisma.elo.findMany({
        where,
        include: { locality: true, eloRole: true },
        orderBy: [{ locality: { name: 'asc' } }, { eloRole: { sortOrder: 'asc' } }],
      }),
      this.prisma.user.findMany({
        where: userWhere,
        select: {
          id: true,
          name: true,
          email: true,
          localityId: true,
          eloRoleId: true,
          locality: { select: { id: true, name: true, code: true } },
          eloRole: { select: { id: true, code: true, name: true, sortOrder: true } },
        },
        orderBy: [{ locality: { name: 'asc' } }, { eloRole: { sortOrder: 'asc' } }, { name: 'asc' }],
      }),
    ]);

    const existingKeySet = new Set<string>();
    for (const item of items) {
      existingKeySet.add(this.buildEloMatchKey(item.localityId, item.eloRoleId, item.name, item.email));
    }

    const grouped = new Map<
      string,
      { localityId: string; localityName: string; localityCode: string; elos: any[] }
    >();
    for (const item of items) {
      const localityName = item.locality?.name ?? item.localityId;
      const localityCode = item.locality?.code ?? '';
      const key = item.localityId;
      if (!grouped.has(key)) {
        grouped.set(key, {
          localityId: item.localityId,
          localityName,
          localityCode,
          elos: [],
        });
      }
      grouped.get(key)!.elos.push(this.mapElo({ ...item, autoFromUser: false }, user?.executiveHidePii));
    }

    for (const candidate of candidates) {
      if (!candidate.localityId || !candidate.eloRoleId) continue;
      const candidateKey = this.buildEloMatchKey(
        candidate.localityId,
        candidate.eloRoleId,
        candidate.name,
        candidate.email,
      );
      if (existingKeySet.has(candidateKey)) continue;

      const groupKey = candidate.localityId;
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          localityId: candidate.localityId,
          localityName: candidate.locality?.name ?? candidate.localityId,
          localityCode: candidate.locality?.code ?? '',
          elos: [],
        });
      }

      grouped.get(groupKey)!.elos.push(
        this.mapElo(
          {
            id: `auto-user-${candidate.id}`,
            localityId: candidate.localityId,
            eloRoleId: candidate.eloRoleId,
            eloRole: candidate.eloRole,
            locality: candidate.locality,
            name: candidate.name,
            email: candidate.email,
            rank: null,
            phone: null,
            om: null,
            autoFromUser: true,
            source: 'USER_ALLOCATION',
            systemUser: {
              id: candidate.id,
              name: candidate.name,
              email: candidate.email,
            },
          },
          user?.executiveHidePii,
        ),
      );
    }

    return {
      items: Array.from(grouped.values()),
      executive_hide_pii: user?.executiveHidePii ?? false,
    };
  }

  async listOrgChartCandidates(
    filters: { localityId?: string; eloRoleId?: string; q?: string },
    user?: RbacUser,
  ) {
    const where: Prisma.UserWhereInput = {
      isActive: true,
      localityId: { not: null },
      eloRoleId: { not: null },
    };
    if (filters.localityId) where.localityId = filters.localityId;
    if (filters.eloRoleId) where.eloRoleId = filters.eloRoleId;
    if (filters.q) {
      where.OR = [
        { name: { contains: filters.q, mode: 'insensitive' } },
        { email: { contains: filters.q, mode: 'insensitive' } },
      ];
    }

    const constraints = this.getScopeConstraints(user);
    if (constraints.localityId) where.localityId = constraints.localityId;

    const items = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        localityId: true,
        eloRoleId: true,
        locality: { select: { id: true, name: true, code: true } },
        eloRole: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ name: 'asc' }],
      take: 300,
    });

    return { items };
  }

  async createOrgChartAssignment(
    payload: {
      localityId: string;
      eloRoleId: string;
      userId: string;
      rank?: string | null;
      phone?: string | null;
      om?: string | null;
    },
    user?: RbacUser,
  ) {
    this.assertCanManageOrgChart(user);
    return this.create(
      {
        localityId: payload.localityId,
        eloRoleId: payload.eloRoleId,
        userId: payload.userId,
        name: '',
        rank: payload.rank ?? null,
        phone: payload.phone ?? null,
        om: payload.om ?? null,
      },
      user,
    );
  }

  async updateOrgChartAssignment(
    id: string,
    payload: {
      localityId?: string;
      eloRoleId?: string;
      userId?: string;
      rank?: string | null;
      phone?: string | null;
      om?: string | null;
    },
    user?: RbacUser,
  ) {
    this.assertCanManageOrgChart(user);
    return this.update(
      id,
      {
        localityId: payload.localityId,
        eloRoleId: payload.eloRoleId,
        userId: payload.userId,
        rank: payload.rank,
        phone: payload.phone,
        om: payload.om,
      },
      user,
    );
  }

  async removeOrgChartAssignment(id: string, user?: RbacUser) {
    this.assertCanManageOrgChart(user);
    return this.remove(id, user);
  }

  private getScopeConstraints(user?: RbacUser) {
    if (!user) return {};
    if (isNationalCommissionMember(user)) return {};
    return {
      localityId: user.localityId ?? undefined,
    };
  }

  private assertConstraints(localityId: string, user?: RbacUser) {
    const constraints = this.getScopeConstraints(user);
    if (constraints.localityId && constraints.localityId !== localityId) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private assertCanManageOrgChart(user?: RbacUser) {
    if (!isNationalCommissionMember(user)) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private async assertUserMatchesAssignment(userId: string, localityId: string, eloRoleId: string) {
    const linkedUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        localityId: true,
        eloRoleId: true,
      },
    });
    if (!linkedUser || !linkedUser.isActive) {
      throwError('VALIDATION_ERROR', { reason: 'ORG_CHART_USER_INVALID' });
    }
    if (!linkedUser.localityId || linkedUser.localityId !== localityId) {
      throwError('VALIDATION_ERROR', {
        reason: 'ORG_CHART_USER_LOCALITY_MISMATCH',
        userId,
        localityId,
      });
    }
    if (!linkedUser.eloRoleId || linkedUser.eloRoleId !== eloRoleId) {
      throwError('VALIDATION_ERROR', {
        reason: 'ORG_CHART_USER_ROLE_MISMATCH',
        userId,
        eloRoleId,
      });
    }
    return linkedUser;
  }

  private buildEloMatchKey(localityId: string, eloRoleId: string, name?: string | null, email?: string | null) {
    const nameKey = String(name ?? '').trim().toLowerCase();
    const emailKey = String(email ?? '').trim().toLowerCase();
    return `${localityId}:${eloRoleId}:${nameKey}:${emailKey}`;
  }

  private mapElo(item: any, executiveHidePii?: boolean) {
    if (!executiveHidePii) return item;
    const { phone, email, name, rank, systemUser, source, ...rest } = item;
    return rest;
  }
}
