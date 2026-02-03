import { Injectable } from '@nestjs/common';
import { Prisma, EloRoleType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RbacUser } from '../rbac/rbac.types';
import { throwError } from '../common/http-error';
import { sanitizeText } from '../common/sanitize';
import { AuditService } from '../audit/audit.service';
import { parsePagination } from '../common/pagination';

@Injectable()
export class ElosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(filters: { localityId?: string; roleType?: string; page?: string; pageSize?: string }, user?: RbacUser) {
    const where: Prisma.EloWhereInput = {};
    if (filters.localityId) where.localityId = filters.localityId;
    if (filters.roleType) where.roleType = filters.roleType as EloRoleType;

    const constraints = this.getScopeConstraints(user);
    if (constraints.localityId) where.localityId = constraints.localityId;

    const { page, pageSize, skip, take } = parsePagination(filters.page, filters.pageSize);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.elo.findMany({
        where,
        include: { locality: true },
        orderBy: [{ locality: { name: 'asc' } }, { roleType: 'asc' }],
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
    roleType: string;
    name: string;
    rank?: string | null;
    phone?: string | null;
    email?: string | null;
    om?: string | null;
  }, user?: RbacUser) {
    this.assertConstraints(payload.localityId, user);
    const created = await this.prisma.elo.create({
      data: {
        localityId: payload.localityId,
        roleType: payload.roleType as EloRoleType,
        name: sanitizeText(payload.name),
        rank: payload.rank ? sanitizeText(payload.rank) : null,
        phone: payload.phone ? sanitizeText(payload.phone) : null,
        email: payload.email ? sanitizeText(payload.email) : null,
        om: payload.om ? sanitizeText(payload.om) : null,
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'elos',
      action: 'create',
      entityId: created.id,
      localityId: created.localityId,
      diffJson: { roleType: created.roleType, name: created.name },
    });

    return this.mapElo(created, user?.executiveHidePii);
  }

  async update(id: string, payload: {
    localityId?: string;
    roleType?: string;
    name?: string;
    rank?: string | null;
    phone?: string | null;
    email?: string | null;
    om?: string | null;
  }, user?: RbacUser) {
    const existing = await this.prisma.elo.findUnique({ where: { id } });
    if (!existing) throwError('NOT_FOUND');

    const localityId = payload.localityId ?? existing.localityId;
    this.assertConstraints(localityId, user);

    const updated = await this.prisma.elo.update({
      where: { id },
      data: {
        localityId,
        roleType: payload.roleType ? (payload.roleType as EloRoleType) : undefined,
        name: payload.name ? sanitizeText(payload.name) : undefined,
        rank: payload.rank ? sanitizeText(payload.rank) : payload.rank === null ? null : undefined,
        phone: payload.phone ? sanitizeText(payload.phone) : payload.phone === null ? null : undefined,
        email: payload.email ? sanitizeText(payload.email) : payload.email === null ? null : undefined,
        om: payload.om ? sanitizeText(payload.om) : payload.om === null ? null : undefined,
      },
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

  async orgChart(filters: { localityId?: string; roleType?: string }, user?: RbacUser) {
    const where: Prisma.EloWhereInput = {};
    if (filters.localityId) where.localityId = filters.localityId;
    if (filters.roleType) where.roleType = filters.roleType as EloRoleType;

    const constraints = this.getScopeConstraints(user);
    if (constraints.localityId) where.localityId = constraints.localityId;

    const items = await this.prisma.elo.findMany({
      where,
      include: { locality: true },
      orderBy: [{ locality: { name: 'asc' } }, { roleType: 'asc' }],
    });

    const grouped: Record<string, any[]> = {};
    for (const item of items) {
      const localityName = item.locality?.name ?? item.localityId;
      if (!grouped[localityName]) grouped[localityName] = [];
      grouped[localityName].push(this.mapElo(item, user?.executiveHidePii));
    }

    return {
      items: Object.entries(grouped).map(([localityName, elos]) => ({
        localityName,
        elos,
      })),
      executive_hide_pii: user?.executiveHidePii ?? false,
    };
  }

  private getScopeConstraints(user?: RbacUser) {
    if (!user) return {};
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

  private mapElo(item: any, executiveHidePii?: boolean) {
    if (!executiveHidePii) return item;
    const { phone, email, ...rest } = item;
    return rest;
  }
}

