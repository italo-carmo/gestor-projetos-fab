import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { parsePagination } from '../common/pagination';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    userId?: string | null;
    localityId?: string | null;
    resource: string;
    action: string;
    entityId?: string | null;
    diffJson?: Record<string, unknown> | null;
  }) {
    const diffJson = params.diffJson ? this.truncateDiff(params.diffJson) : Prisma.JsonNull;
    return this.prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        localityId: params.localityId ?? null,
        resource: params.resource,
        action: params.action,
        entityId: params.entityId ?? null,
        diffJson: diffJson as any,
      },
    });
  }

  private truncateDiff(diff: Record<string, unknown>) {
    const raw = JSON.stringify(diff);
    if (raw.length <= 2000) return diff;
    return { truncated: raw.slice(0, 2000) };
  }

  async list(filters: {
    resource?: string;
    userId?: string;
    localityId?: string;
    entityId?: string;
    from?: string;
    to?: string;
    page?: string;
    pageSize?: string;
  }) {
    const where: Prisma.AuditLogWhereInput = {};
    if (filters.resource) where.resource = filters.resource;
    if (filters.userId) where.userId = filters.userId;
    if (filters.localityId) where.localityId = filters.localityId;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(filters.to);
    }

    const { page, pageSize, skip, take } = parsePagination(filters.page, filters.pageSize);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { user: true, locality: true },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, page, pageSize, total };
  }
}
