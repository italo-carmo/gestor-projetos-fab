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

  async list(
    filters: { q?: string; localityId?: string; typeId?: string },
    user?: RbacUser,
  ) {
    this.assertViewerAccess(user);

    const where: any = {};
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
    if (filters.typeId) {
      where.typeId = String(filters.typeId).trim();
    }

    try {
      const items = await (this.prisma as any).bestPracticePost.findMany({
        where,
        include: {
          locality: { select: { id: true, name: true, code: true } },
          type: {
            select: {
              id: true,
              name: true,
              colorHex: true,
              textColorHex: true,
            },
          },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: [{ isCommission: 'desc' }, { createdAt: 'desc' }],
      });
      return { items };
    } catch {
      // Backward-compatible fallback for environments with outdated Prisma client.
      const legacyItems = await (this.prisma as any).bestPracticePost.findMany({
        where,
        include: {
          locality: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: [{ isCommission: 'desc' }, { createdAt: 'desc' }],
      });
      return {
        items: legacyItems.map((item: any) => ({ ...item, type: null })),
      };
    }
  }

  async listTypes(user?: RbacUser) {
    this.assertViewerAccess(user);
    if (!(this.prisma as any).bestPracticeType) {
      return { items: [] };
    }
    const items = await (this.prisma as any).bestPracticeType.findMany({
      orderBy: [{ name: 'asc' }],
    });
    return { items };
  }

  async create(
    payload: {
      title: string;
      content: string;
      localityId?: string | null;
      isCommission?: boolean;
      typeId?: string | null;
    },
    user?: RbacUser,
  ) {
    this.assertCreatorAccess(user);

    const title = this.normalizeRequiredText(payload.title, 'title', 140);
    const content = this.normalizeRequiredText(
      payload.content,
      'content',
      1200,
    );
    const isCommission = Boolean(payload.isCommission);
    const localityId = this.resolveLocalityTarget(
      payload.localityId,
      isCommission,
    );
    const typeId = await this.resolveTypeTarget(payload.typeId);

    const created = await (this.prisma as any).bestPracticePost.create({
      data: {
        title,
        content,
        isCommission,
        localityId,
        typeId,
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
        typeId: created.typeId ?? null,
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
      typeId?: string | null;
    },
    user?: RbacUser,
  ) {
    this.assertUpdaterAccess(user);
    const existing = await (this.prisma as any).bestPracticePost.findUnique({
      where: { id },
    });
    if (!existing) throwError('NOT_FOUND');

    const nextIsCommission =
      payload.isCommission !== undefined
        ? Boolean(payload.isCommission)
        : existing.isCommission;
    const nextLocalityId = this.resolveLocalityTarget(
      payload.localityId !== undefined
        ? payload.localityId
        : existing.localityId,
      nextIsCommission,
    );
    const nextTypeId =
      payload.typeId !== undefined
        ? await this.resolveTypeTarget(payload.typeId)
        : (existing.typeId ?? null);

    const updated = await (this.prisma as any).bestPracticePost.update({
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
          payload.isCommission !== undefined
            ? Boolean(payload.isCommission)
            : undefined,
        localityId: nextLocalityId,
        typeId: nextTypeId,
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
        typeId: updated.typeId ?? null,
      },
    });

    return updated;
  }

  async remove(id: string, user?: RbacUser) {
    this.assertDeleteAccess(user);
    const existing = await (this.prisma as any).bestPracticePost.findUnique({
      where: { id },
    });
    if (!existing) throwError('NOT_FOUND');

    await (this.prisma as any).bestPracticePost.delete({ where: { id } });
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

  private assertUpdaterAccess(user?: RbacUser) {
    if (!hasAnyRole(user, [ROLE_COORDENACAO_CIPAVD, ROLE_TI])) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private assertDeleteAccess(user?: RbacUser) {
    if (!hasRole(user, ROLE_COORDENACAO_CIPAVD)) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private assertCreatorAccess(user?: RbacUser) {
    if (!hasAnyRole(user, [ROLE_COORDENACAO_CIPAVD, ROLE_TI])) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private async resolveTypeTarget(typeId: string | null | undefined) {
    const id = String(typeId ?? '').trim();
    if (!id) return null;
    if (!(this.prisma as any).bestPracticeType) {
      throwError('VALIDATION_ERROR', {
        field: 'typeId',
        reason: 'feature_unavailable',
      });
    }

    const found = await (this.prisma as any).bestPracticeType.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) {
      throwError('NOT_FOUND');
    }

    return id;
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

  async createType(
    payload: { name: string; colorHex: string; textColorHex?: string },
    user?: RbacUser,
  ) {
    this.assertTypeEditorAccess(user);
    if (!(this.prisma as any).bestPracticeType) {
      throwError('VALIDATION_ERROR', {
        field: 'type',
        reason: 'feature_unavailable',
      });
    }

    const normalized = this.normalizeRequiredText(payload.name, 'name', 80);
    const colorHex = this.normalizeColorHex(payload.colorHex);
    const textColorHex = payload.textColorHex
      ? this.normalizeColorHex(payload.textColorHex)
      : '#FFFFFF';

    const existing = await (this.prisma as any).bestPracticeType.findFirst({
      where: { name: { equals: normalized, mode: 'insensitive' } },
      select: { id: true, name: true },
    });
    if (existing) {
      throwError('VALIDATION_ERROR', { field: 'name', reason: 'duplicate' });
    }

    const created = await (this.prisma as any).bestPracticeType.create({
      data: {
        name: normalized,
        colorHex,
        textColorHex,
      },
      select: { id: true, name: true, colorHex: true, textColorHex: true },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'best_practice_types',
      action: 'create',
      entityId: created.id,
      diffJson: { name: created.name },
    });

    return created;
  }

  async updateType(
    id: string,
    payload: { name?: string; colorHex?: string; textColorHex?: string },
    user?: RbacUser,
  ) {
    this.assertTypeEditorAccess(user);
    if (!(this.prisma as any).bestPracticeType) {
      throwError('VALIDATION_ERROR', {
        field: 'type',
        reason: 'feature_unavailable',
      });
    }

    const existing = await (this.prisma as any).bestPracticeType.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throwError('NOT_FOUND');

    const updateData: any = {};
    if (payload.name !== undefined) {
      const normalized = this.normalizeRequiredText(payload.name, 'name', 80);
      const duplicate = await (this.prisma as any).bestPracticeType.findFirst({
        where: {
          name: { equals: normalized, mode: 'insensitive' },
          id: { not: id },
        },
        select: { id: true },
      });
      if (duplicate) {
        throwError('VALIDATION_ERROR', { field: 'name', reason: 'duplicate' });
      }
      updateData.name = normalized;
    }
    if (payload.colorHex !== undefined) {
      updateData.colorHex = this.normalizeColorHex(payload.colorHex);
    }
    if (payload.textColorHex !== undefined) {
      updateData.textColorHex = payload.textColorHex
        ? this.normalizeColorHex(payload.textColorHex)
        : '#FFFFFF';
    }

    const updated = await (this.prisma as any).bestPracticeType.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, colorHex: true, textColorHex: true },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'best_practice_types',
      action: 'update',
      entityId: updated.id,
      diffJson: { name: updated.name },
    });

    return updated;
  }

  async removeType(id: string, user?: RbacUser) {
    this.assertTypeEditorAccess(user);
    if (!(this.prisma as any).bestPracticeType) {
      throwError('VALIDATION_ERROR', {
        field: 'type',
        reason: 'feature_unavailable',
      });
    }

    const existing = await (this.prisma as any).bestPracticeType.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!existing) throwError('NOT_FOUND');

    const inUse = await (this.prisma as any).bestPracticePost.findFirst({
      where: { typeId: id },
      select: { id: true },
    });
    if (inUse) {
      throwError('VALIDATION_ERROR', { field: 'id', reason: 'in_use' });
    }

    await (this.prisma as any).bestPracticeType.delete({ where: { id } });
    await this.audit.log({
      userId: user?.id,
      resource: 'best_practice_types',
      action: 'delete',
      entityId: existing.id,
      diffJson: { name: existing.name },
    });

    return { ok: true };
  }

  private assertTypeEditorAccess(user?: RbacUser) {
    if (!hasAnyRole(user, [ROLE_COORDENACAO_CIPAVD, ROLE_TI])) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private normalizeColorHex(value: string) {
    const hex = String(value).trim();
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      throwError('VALIDATION_ERROR', {
        field: 'colorHex',
        reason: 'invalid_format',
      });
    }
    return hex.toUpperCase();
  }

  private buildAuthorLabel(user?: RbacUser) {
    const raw = sanitizeText(user?.name ?? '');
    if (!raw) return 'Coordenação CIPAVD';
    const tokens = raw.split(/\s+/).filter(Boolean);
    if (tokens.length >= 3) {
      const last = String(tokens[tokens.length - 1] ?? '').toUpperCase();
      const first = String(tokens[0] ?? '').toUpperCase();
      const looksLikeRank =
        /^(ALUNO|SD|CB|3S|2S|1S|SO|ASP|CP|CL|MB|TB|2T|1T|CAP|MAJ|TCEL|TEN|CEL|BRIG|GEN)$/.test(
          first,
        );
      const looksLikeOm = /^[A-Z0-9-]{2,14}$/.test(last);
      if (looksLikeRank && looksLikeOm) {
        return tokens.slice(0, -1).join(' ').trim() || raw;
      }
    }
    return raw;
  }
}
