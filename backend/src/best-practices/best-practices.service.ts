import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { throwError } from '../common/http-error';
import { sanitizeText } from '../common/sanitize';
import { PrismaService } from '../prisma/prisma.service';
import {
  hasAnyRole,
  hasRole,
  ROLE_COMANDANTE_COMGEP,
  ROLE_COORDENACAO_CIPAVD,
  ROLE_TI,
} from '../rbac/role-access';
import type { RbacUser } from '../rbac/rbac.types';

@Injectable()
export class BestPracticesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(filters: { q?: string; localityId?: string }, user?: RbacUser) {
    this.assertViewerAccess(user);

    const where: Prisma.BestPracticePostWhereInput = {};
    if (filters.q) {
      const q = String(filters.q).trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
        { authorLabel: { contains: q, mode: 'insensitive' } },
        { locality: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }
    if (filters.localityId) {
      if (filters.localityId === '__commission__') {
        where.isCommission = true;
      } else {
        where.localityId = filters.localityId;
      }
    }

    const items = await this.prisma.bestPracticePost.findMany({
      where,
      include: {
        locality: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: [{ isCommission: 'desc' }, { createdAt: 'desc' }],
    });

    return { items };
  }

  async create(
    payload: {
      title: string;
      content: string;
      localityId?: string | null;
      isCommission?: boolean;
    },
    user?: RbacUser,
  ) {
    this.assertEditorAccess(user);

    const title = this.normalizeRequiredText(payload.title, 'title', 140);
    const content = this.normalizeRequiredText(payload.content, 'content', 1200);
    const isCommission = Boolean(payload.isCommission);
    const localityId = this.resolveLocalityTarget(payload.localityId, isCommission);

    const created = await this.prisma.bestPracticePost.create({
      data: {
        title,
        content,
        isCommission,
        localityId,
        createdById: user?.id ?? null,
        authorLabel: this.buildAuthorLabel(user),
      },
      include: {
        locality: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    await this.audit.log({
      userId: user?.id,
      localityId: created.localityId ?? undefined,
      resource: 'best_practices',
      action: 'create',
      entityId: created.id,
      diffJson: {
        title: created.title,
        isCommission: created.isCommission,
      },
    });

    return created;
  }

  async update(
    id: string,
    payload: {
      title?: string;
      content?: string;
      localityId?: string | null;
      isCommission?: boolean;
    },
    user?: RbacUser,
  ) {
    this.assertEditorAccess(user);
    const existing = await this.prisma.bestPracticePost.findUnique({ where: { id } });
    if (!existing) throwError('NOT_FOUND');

    const nextIsCommission =
      payload.isCommission !== undefined ? Boolean(payload.isCommission) : existing.isCommission;
    const nextLocalityId = this.resolveLocalityTarget(
      payload.localityId !== undefined ? payload.localityId : existing.localityId,
      nextIsCommission,
    );

    const updated = await this.prisma.bestPracticePost.update({
      where: { id },
      data: {
        title:
          payload.title !== undefined
            ? this.normalizeRequiredText(payload.title, 'title', 140)
            : undefined,
        content:
          payload.content !== undefined
            ? this.normalizeRequiredText(payload.content, 'content', 1200)
            : undefined,
        isCommission:
          payload.isCommission !== undefined ? Boolean(payload.isCommission) : undefined,
        localityId: nextLocalityId,
      },
      include: {
        locality: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    await this.audit.log({
      userId: user?.id,
      localityId: updated.localityId ?? undefined,
      resource: 'best_practices',
      action: 'update',
      entityId: updated.id,
      diffJson: {
        title: updated.title,
        isCommission: updated.isCommission,
      },
    });

    return updated;
  }

  async remove(id: string, user?: RbacUser) {
    this.assertEditorAccess(user);
    const existing = await this.prisma.bestPracticePost.findUnique({ where: { id } });
    if (!existing) throwError('NOT_FOUND');

    await this.prisma.bestPracticePost.delete({ where: { id } });
    await this.audit.log({
      userId: user?.id,
      localityId: existing.localityId ?? undefined,
      resource: 'best_practices',
      action: 'delete',
      entityId: existing.id,
      diffJson: {
        title: existing.title,
        isCommission: existing.isCommission,
      },
    });
    return { ok: true };
  }

  private assertViewerAccess(user?: RbacUser) {
    if (
      !hasAnyRole(user, [
        ROLE_COORDENACAO_CIPAVD,
        ROLE_TI,
        ROLE_COMANDANTE_COMGEP,
      ])
    ) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private assertEditorAccess(user?: RbacUser) {
    if (!hasRole(user, ROLE_COORDENACAO_CIPAVD)) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private resolveLocalityTarget(
    localityId: string | null | undefined,
    isCommission: boolean,
  ) {
    if (isCommission) return null;
    const id = String(localityId ?? '').trim();
    if (!id) {
      throwError('VALIDATION_ERROR', {
        field: 'localityId',
        reason: 'required_for_locality_post',
      });
    }
    return id;
  }

  private normalizeRequiredText(
    value: string,
    field: string,
    maxLength: number,
  ) {
    const normalized = sanitizeText(value);
    if (!normalized) {
      throwError('VALIDATION_ERROR', { field, reason: 'required' });
    }
    if (normalized.length > maxLength) {
      throwError('VALIDATION_ERROR', { field, reason: 'too_long' });
    }
    return normalized;
  }

  private buildAuthorLabel(user?: RbacUser) {
    const raw = sanitizeText(user?.name ?? '');
    if (!raw) return 'Coordenação CIPAVD';
    const tokens = raw.split(/\s+/).filter(Boolean);
    if (tokens.length >= 3) {
      const last = String(tokens[tokens.length - 1] ?? '').toUpperCase();
      const first = String(tokens[0] ?? '').toUpperCase();
      const looksLikeRank = /^(ALUNO|SD|CB|3S|2S|1S|SO|ASP|CP|CL|MB|TB|2T|1T|CAP|MAJ|TCEL|TEN|CEL|BRIG|GEN)$/.test(first);
      const looksLikeOm = /^[A-Z0-9-]{2,14}$/.test(last);
      if (looksLikeRank && looksLikeOm) {
        return tokens.slice(0, -1).join(' ').trim() || raw;
      }
    }
    return raw;
  }
}


