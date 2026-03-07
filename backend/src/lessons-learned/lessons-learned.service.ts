import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { throwError } from '../common/http-error';
import { sanitizeText } from '../common/sanitize';
import { PrismaService } from '../prisma/prisma.service';
import {
  hasAnyRole,
  ROLE_COMANDANTE_COMGEP,
  ROLE_COORDENACAO_CIPAVD,
  ROLE_TI,
} from '../rbac/role-access';
import type { RbacUser } from '../rbac/rbac.types';

@Injectable()
export class LessonsLearnedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(filters: { q?: string; typeId?: string }, user?: RbacUser) {
    this.assertViewerAccess(user);

    const where: Prisma.LessonLearnedPostWhereInput = {};
    if (filters.q) {
      const q = String(filters.q).trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
        { authorLabel: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (filters.typeId) {
      where.typeId = String(filters.typeId).trim();
    }

    const items = await this.prisma.lessonLearnedPost.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
        type: { select: { id: true, name: true, colorHex: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return { items };
  }

  async listTypes(user?: RbacUser) {
    this.assertViewerAccess(user);
    const items = await this.prisma.lessonLearnedType.findMany({
      orderBy: [{ name: 'asc' }],
    });
    return { items };
  }

  async create(
    payload: { title: string; content: string; typeId: string },
    user?: RbacUser,
  ) {
    this.assertEditorAccess(user);

    const title = this.normalizeRequiredText(payload.title, 'title', 140);
    const content = this.normalizeRequiredText(payload.content, 'content', 1200);
    const typeId = await this.resolveTypeId(payload.typeId);

    const created = await this.prisma.lessonLearnedPost.create({
      data: {
        title,
        content,
        typeId,
        createdById: user?.id ?? null,
        authorLabel: this.buildAuthorLabel(user),
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        type: { select: { id: true, name: true, colorHex: true } },
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'lessons_learned',
      action: 'create',
      entityId: created.id,
      diffJson: { title: created.title },
    });

    return created;
  }

  async update(
    id: string,
    payload: { title?: string; content?: string; typeId?: string },
    user?: RbacUser,
  ) {
    this.assertEditorAccess(user);
    const existing = await this.prisma.lessonLearnedPost.findUnique({
      where: { id },
    });
    if (!existing) throwError('NOT_FOUND');

    const updated = await this.prisma.lessonLearnedPost.update({
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
        typeId:
          payload.typeId !== undefined
            ? await this.resolveTypeId(payload.typeId)
            : undefined,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        type: { select: { id: true, name: true, colorHex: true } },
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'lessons_learned',
      action: 'update',
      entityId: updated.id,
      diffJson: { title: updated.title },
    });

    return updated;
  }

  async remove(id: string, user?: RbacUser) {
    this.assertEditorAccess(user);
    const existing = await this.prisma.lessonLearnedPost.findUnique({
      where: { id },
    });
    if (!existing) throwError('NOT_FOUND');

    await this.prisma.lessonLearnedPost.delete({ where: { id } });
    await this.audit.log({
      userId: user?.id,
      resource: 'lessons_learned',
      action: 'delete',
      entityId: existing.id,
      diffJson: { title: existing.title },
    });
    return { ok: true };
  }

  async createType(payload: { name: string; colorHex: string }, user?: RbacUser) {
    this.assertEditorAccess(user);
    const name = this.normalizeRequiredText(payload.name, 'name', 80);
    const colorHex = this.normalizeColorHex(payload.colorHex);
    const existing = await this.prisma.lessonLearnedType.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) {
      throwError('VALIDATION_ERROR', { field: 'name', reason: 'already_exists' });
    }
    const created = await this.prisma.lessonLearnedType.create({
      data: { name, colorHex },
    });
    await this.audit.log({
      userId: user?.id,
      resource: 'lessons_learned',
      action: 'create',
      entityId: created.id,
      diffJson: { type: created.name, colorHex: created.colorHex },
    });
    return created;
  }

  async updateType(
    id: string,
    payload: { name?: string; colorHex?: string },
    user?: RbacUser,
  ) {
    this.assertEditorAccess(user);
    const existing = await this.prisma.lessonLearnedType.findUnique({
      where: { id },
    });
    if (!existing) throwError('NOT_FOUND');
    const nextName =
      payload.name !== undefined
        ? this.normalizeRequiredText(payload.name, 'name', 80)
        : undefined;
    if (nextName && nextName.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicated = await this.prisma.lessonLearnedType.findFirst({
        where: {
          id: { not: id },
          name: { equals: nextName, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (duplicated) {
        throwError('VALIDATION_ERROR', { field: 'name', reason: 'already_exists' });
      }
    }
    const updated = await this.prisma.lessonLearnedType.update({
      where: { id },
      data: {
        name: nextName,
        colorHex:
          payload.colorHex !== undefined
            ? this.normalizeColorHex(payload.colorHex)
            : undefined,
      },
    });
    await this.audit.log({
      userId: user?.id,
      resource: 'lessons_learned',
      action: 'update',
      entityId: updated.id,
      diffJson: { type: updated.name, colorHex: updated.colorHex },
    });
    return updated;
  }

  async removeType(id: string, user?: RbacUser) {
    this.assertEditorAccess(user);
    const existing = await this.prisma.lessonLearnedType.findUnique({
      where: { id },
    });
    if (!existing) throwError('NOT_FOUND');
    const inUse = await this.prisma.lessonLearnedPost.count({
      where: { typeId: id },
    });
    if (inUse > 0) {
      throwError('VALIDATION_ERROR', {
        field: 'typeId',
        reason: 'LESSON_TYPE_IN_USE',
      });
    }
    await this.prisma.lessonLearnedType.delete({ where: { id } });
    await this.audit.log({
      userId: user?.id,
      resource: 'lessons_learned',
      action: 'delete',
      entityId: id,
      diffJson: { type: existing.name },
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
    if (!hasAnyRole(user, [ROLE_COORDENACAO_CIPAVD, ROLE_TI])) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private normalizeRequiredText(value: string, field: string, maxLength: number) {
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

  private async resolveTypeId(typeId: string) {
    const normalized = String(typeId ?? '').trim();
    if (!normalized) {
      throwError('VALIDATION_ERROR', { field: 'typeId', reason: 'required' });
    }
    const existing = await this.prisma.lessonLearnedType.findUnique({
      where: { id: normalized },
      select: { id: true },
    });
    if (!existing) {
      throwError('VALIDATION_ERROR', { field: 'typeId', reason: 'invalid' });
    }
    return existing.id;
  }

  private normalizeColorHex(value: string) {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(normalized)) {
      throwError('VALIDATION_ERROR', { field: 'colorHex', reason: 'invalid' });
    }
    return normalized;
  }
}


