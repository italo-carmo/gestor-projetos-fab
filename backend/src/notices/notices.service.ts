import { Injectable } from '@nestjs/common';
import { Prisma, NoticePriority } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RbacUser } from '../rbac/rbac.types';
import { throwError } from '../common/http-error';
import { sanitizeText } from '../common/sanitize';
import { parsePagination } from '../common/pagination';
import { resolveAccessProfile } from '../rbac/role-access';

@Injectable()
export class NoticesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(filters: {
    localityId?: string;
    specialtyId?: string;
    pinned?: string;
    priority?: string;
    dueFrom?: string;
    dueTo?: string;
    page?: string;
    pageSize?: string;
  }, user?: RbacUser) {
    const where: Prisma.NoticeWhereInput = {};

    if (filters.localityId) where.localityId = filters.localityId;
    if (filters.specialtyId) where.specialtyId = filters.specialtyId;
    if (filters.pinned !== undefined) where.pinned = filters.pinned === 'true';
    if (filters.priority) where.priority = filters.priority as NoticePriority;
    if (filters.dueFrom || filters.dueTo) {
      where.dueDate = {};
      if (filters.dueFrom) where.dueDate.gte = new Date(filters.dueFrom);
      if (filters.dueTo) where.dueDate.lte = new Date(filters.dueTo);
    }

    const constraints = this.getScopeConstraints(user);
    const scopeFilters: Prisma.NoticeWhereInput[] = [];
    if (constraints.localityId) {
      scopeFilters.push({
        OR: [{ localityId: null }, { localityId: constraints.localityId }],
      });
    }
    if (constraints.specialtyId) {
      scopeFilters.push({
        OR: [{ specialtyId: null }, { specialtyId: constraints.specialtyId }],
      });
    }
    if (scopeFilters.length > 0) {
      const andArr = Array.isArray(where.AND) ? where.AND : (where.AND ? [where.AND] : []);
      where.AND = [...andArr, ...scopeFilters];
    }

    const { page, pageSize, skip, take } = parsePagination(filters.page, filters.pageSize);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notice.findMany({
        where,
        orderBy: [{ pinned: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.notice.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        isLate: item.dueDate ? item.dueDate.getTime() < Date.now() : false,
      })),
      page,
      pageSize,
      total,
    };
  }

  async create(payload: {
    title: string;
    body: string;
    localityId?: string | null;
    specialtyId?: string | null;
    dueDate?: string | null;
    priority?: string;
    pinned?: boolean;
  }, user?: RbacUser) {
    const localityId = payload.localityId ?? null;
    const specialtyId = payload.specialtyId ?? null;
    this.assertConstraints(localityId, specialtyId, user);

    const created = await this.prisma.notice.create({
      data: {
        title: sanitizeText(payload.title),
        body: sanitizeText(payload.body),
        localityId,
        specialtyId,
        dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
        priority: (payload.priority as NoticePriority) ?? NoticePriority.MEDIUM,
        pinned: payload.pinned ?? false,
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'notices',
      action: 'create',
      entityId: created.id,
      localityId: created.localityId ?? undefined,
      diffJson: { title: created.title, priority: created.priority },
    });

    return created;
  }

  async update(id: string, payload: {
    title?: string;
    body?: string;
    localityId?: string | null;
    specialtyId?: string | null;
    dueDate?: string | null;
    priority?: string;
    pinned?: boolean;
  }, user?: RbacUser) {
    const existing = await this.prisma.notice.findUnique({ where: { id } });
    if (!existing) throwError('NOT_FOUND');

    const localityId = payload.localityId ?? existing.localityId ?? null;
    const specialtyId = payload.specialtyId ?? existing.specialtyId ?? null;
    this.assertConstraints(localityId, specialtyId, user);

    const updated = await this.prisma.notice.update({
      where: { id },
      data: {
        title: payload.title ? sanitizeText(payload.title) : undefined,
        body: payload.body ? sanitizeText(payload.body) : undefined,
        localityId,
        specialtyId,
        dueDate: payload.dueDate ? new Date(payload.dueDate) : payload.dueDate === null ? null : undefined,
        priority: payload.priority ? (payload.priority as NoticePriority) : undefined,
        pinned: payload.pinned ?? undefined,
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'notices',
      action: 'update',
      entityId: id,
      localityId: updated.localityId ?? undefined,
      diffJson: { title: updated.title, priority: updated.priority, pinned: updated.pinned },
    });

    return updated;
  }

  async remove(id: string, user?: RbacUser) {
    const existing = await this.prisma.notice.findUnique({ where: { id } });
    if (!existing) throwError('NOT_FOUND');
    this.assertConstraints(existing.localityId, existing.specialtyId, user);

    await this.prisma.notice.delete({ where: { id } });

    await this.audit.log({
      userId: user?.id,
      resource: 'notices',
      action: 'delete',
      entityId: id,
      localityId: existing.localityId ?? undefined,
    });

    return { ok: true };
  }

  async pin(id: string, pinned: boolean, user?: RbacUser) {
    const existing = await this.prisma.notice.findUnique({ where: { id } });
    if (!existing) throwError('NOT_FOUND');
    this.assertConstraints(existing.localityId, existing.specialtyId, user);

    const updated = await this.prisma.notice.update({
      where: { id },
      data: { pinned },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'notices',
      action: 'pin',
      entityId: id,
      localityId: updated.localityId ?? undefined,
      diffJson: { pinned },
    });

    return updated;
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
      };
    }
    if (profile.specialtyAdmin) {
      return {
        localityId: profile.localityId ?? undefined,
        specialtyId: profile.groupSpecialtyId ?? undefined,
      };
    }
    return {
      localityId: user.localityId ?? undefined,
      specialtyId: user.specialtyId ?? undefined,
    };
  }

  private assertConstraints(localityId: string | null, specialtyId: string | null, user?: RbacUser) {
    const constraints = this.getScopeConstraints(user);
    if (constraints.localityId && constraints.localityId !== localityId) {
      throwError('RBAC_FORBIDDEN');
    }
    if (constraints.specialtyId && constraints.specialtyId !== specialtyId) {
      throwError('RBAC_FORBIDDEN');
    }
  }
}
