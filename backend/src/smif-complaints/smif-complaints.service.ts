import { Injectable } from '@nestjs/common';
import { Prisma, SmifComplaintStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { throwError } from '../common/http-error';
import { sanitizeText } from '../common/sanitize';
import { PrismaService } from '../prisma/prisma.service';
import {
  hasAnyRole,
  ROLE_COORDENACAO_CIPAVD,
  ROLE_TI,
} from '../rbac/role-access';
import type { RbacUser } from '../rbac/rbac.types';

@Injectable()
export class SmifComplaintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    filters: { q?: string; status?: SmifComplaintStatus; localityId?: string },
    user?: RbacUser,
  ) {
    this.assertEditorAccess(user);

    const where: Prisma.SmifComplaintWhereInput = {};

    if (filters.q) {
      const q = String(filters.q).trim();
      if (q) {
        where.OR = [
          { description: { contains: q, mode: 'insensitive' } },
          { conclusion: { contains: q, mode: 'insensitive' } },
          { locality: { name: { contains: q, mode: 'insensitive' } } },
        ];
      }
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.localityId) {
      where.localityId = String(filters.localityId).trim();
    }

    const items = await this.prisma.smifComplaint.findMany({
      where,
      include: {
        locality: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ reportedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return { items };
  }

  async create(
    payload: {
      localityId: string;
      reportedAt: string;
      description: string;
      status?: SmifComplaintStatus;
      conclusion?: string;
    },
    user?: RbacUser,
  ) {
    this.assertEditorAccess(user);
    const actorId = this.resolveActorId(user);

    const localityId = await this.resolveLocalityId(payload.localityId);
    const reportedAt = this.normalizeDate(payload.reportedAt, 'reportedAt');
    const description = this.normalizeRequiredText(
      payload.description,
      'description',
      4000,
    );
    const status = payload.status ?? SmifComplaintStatus.IN_PROGRESS;
    const conclusion = this.normalizeOptionalText(payload.conclusion, 4000);

    const created = await this.prisma.smifComplaint.create({
      data: {
        localityId,
        reportedAt,
        description,
        status,
        conclusion,
        createdById: actorId,
      },
      include: {
        locality: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'smif_complaints',
      action: 'create',
      entityId: created.id,
      localityId: created.localityId,
      diffJson: {
        localityId: created.localityId,
        reportedAt: created.reportedAt,
        status: created.status,
      },
    });

    return created;
  }

  async update(
    id: string,
    payload: {
      localityId?: string;
      reportedAt?: string;
      description?: string;
      status?: SmifComplaintStatus;
      conclusion?: string;
    },
    user?: RbacUser,
  ) {
    this.assertEditorAccess(user);
    const actorId = this.resolveActorId(user);

    const existing = await this.prisma.smifComplaint.findUnique({
      where: { id },
    });
    if (!existing) throwError('NOT_FOUND');

    const localityId =
      payload.localityId !== undefined
        ? await this.resolveLocalityId(payload.localityId)
        : undefined;
    const reportedAt =
      payload.reportedAt !== undefined
        ? this.normalizeDate(payload.reportedAt, 'reportedAt')
        : undefined;
    const description =
      payload.description !== undefined
        ? this.normalizeRequiredText(payload.description, 'description', 4000)
        : undefined;
    const conclusion =
      payload.conclusion !== undefined
        ? this.normalizeOptionalText(payload.conclusion, 4000)
        : undefined;

    const updated = await this.prisma.smifComplaint.update({
      where: { id },
      data: {
        localityId,
        reportedAt,
        description,
        status: payload.status,
        conclusion,
        updatedById: actorId,
      },
      include: {
        locality: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'smif_complaints',
      action: 'update',
      entityId: updated.id,
      localityId: updated.localityId,
      diffJson: {
        localityId: updated.localityId,
        reportedAt: updated.reportedAt,
        status: updated.status,
      },
    });

    return updated;
  }

  private assertEditorAccess(user?: RbacUser) {
    if (!hasAnyRole(user, [ROLE_COORDENACAO_CIPAVD, ROLE_TI])) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private resolveActorId(user?: RbacUser) {
    const id = String(user?.id ?? '').trim();
    if (!id) {
      throwError('RBAC_FORBIDDEN');
    }
    return id;
  }

  private normalizeDate(value: string, field: string) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) {
      throwError('VALIDATION_ERROR', { field, reason: 'invalid_date' });
    }
    return date;
  }

  private normalizeRequiredText(
    value: string,
    field: string,
    maxLength: number,
  ) {
    const normalized = sanitizeText(value ?? '');
    if (!normalized) {
      throwError('VALIDATION_ERROR', { field, reason: 'required' });
    }
    if (normalized.length > maxLength) {
      throwError('VALIDATION_ERROR', { field, reason: 'too_long' });
    }
    return normalized;
  }

  private normalizeOptionalText(value: string | undefined, maxLength: number) {
    if (value === undefined) return undefined;
    const normalized = sanitizeText(value ?? '');
    if (!normalized) return null;
    if (normalized.length > maxLength) {
      throwError('VALIDATION_ERROR', {
        field: 'conclusion',
        reason: 'too_long',
      });
    }
    return normalized;
  }

  private async resolveLocalityId(localityId: string) {
    const id = String(localityId ?? '').trim();
    if (!id) {
      throwError('VALIDATION_ERROR', {
        field: 'localityId',
        reason: 'required',
      });
    }
    const exists = await this.prisma.locality.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throwError('VALIDATION_ERROR', {
        field: 'localityId',
        reason: 'not_found',
      });
    }
    return id;
  }
}
