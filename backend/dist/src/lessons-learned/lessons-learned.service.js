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
exports.LessonsLearnedService = void 0;
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../audit/audit.service");
const http_error_1 = require("../common/http-error");
const sanitize_1 = require("../common/sanitize");
const prisma_service_1 = require("../prisma/prisma.service");
const role_access_1 = require("../rbac/role-access");
let LessonsLearnedService = class LessonsLearnedService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async list(filters, user) {
        this.assertViewerAccess(user);
        const where = {};
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
                type: { select: { id: true, name: true, colorHex: true, textColorHex: true } },
            },
            orderBy: [{ createdAt: 'desc' }],
        });
        return { items };
    }
    async listTypes(user) {
        this.assertViewerAccess(user);
        const items = await this.prisma.lessonLearnedType.findMany({
            orderBy: [{ name: 'asc' }],
        });
        return { items };
    }
    async create(payload, user) {
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
                type: { select: { id: true, name: true, colorHex: true, textColorHex: true } },
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
    async update(id, payload, user) {
        this.assertEditorAccess(user);
        const existing = await this.prisma.lessonLearnedPost.findUnique({
            where: { id },
        });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
        const updated = await this.prisma.lessonLearnedPost.update({
            where: { id },
            data: {
                title: payload.title !== undefined
                    ? this.normalizeRequiredText(payload.title, 'title', 140)
                    : undefined,
                content: payload.content !== undefined
                    ? this.normalizeRequiredText(payload.content, 'content', 1200)
                    : undefined,
                typeId: payload.typeId !== undefined
                    ? await this.resolveTypeId(payload.typeId)
                    : undefined,
            },
            include: {
                createdBy: { select: { id: true, name: true } },
                type: { select: { id: true, name: true, colorHex: true, textColorHex: true } },
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
    async remove(id, user) {
        this.assertEditorAccess(user);
        const existing = await this.prisma.lessonLearnedPost.findUnique({
            where: { id },
        });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
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
    async createType(payload, user) {
        this.assertEditorAccess(user);
        const name = this.normalizeRequiredText(payload.name, 'name', 80);
        const colorHex = this.normalizeColorHex(payload.colorHex);
        const textColorHex = payload.textColorHex ? this.normalizeColorHex(payload.textColorHex) : '#FFFFFF';
        const existing = await this.prisma.lessonLearnedType.findFirst({
            where: { name: { equals: name, mode: 'insensitive' } },
            select: { id: true },
        });
        if (existing) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field: 'name', reason: 'already_exists' });
        }
        const created = await this.prisma.lessonLearnedType.create({
            data: { name, colorHex, textColorHex },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'lessons_learned',
            action: 'create',
            entityId: created.id,
            diffJson: { type: created.name, colorHex: created.colorHex, textColorHex: created.textColorHex },
        });
        return created;
    }
    async updateType(id, payload, user) {
        this.assertEditorAccess(user);
        const existing = await this.prisma.lessonLearnedType.findUnique({
            where: { id },
        });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
        const nextName = payload.name !== undefined
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
                (0, http_error_1.throwError)('VALIDATION_ERROR', { field: 'name', reason: 'already_exists' });
            }
        }
        const updated = await this.prisma.lessonLearnedType.update({
            where: { id },
            data: {
                name: nextName,
                colorHex: payload.colorHex !== undefined
                    ? this.normalizeColorHex(payload.colorHex)
                    : undefined,
                textColorHex: payload.textColorHex !== undefined
                    ? this.normalizeColorHex(payload.textColorHex)
                    : undefined,
            },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'lessons_learned',
            action: 'update',
            entityId: updated.id,
            diffJson: { type: updated.name, colorHex: updated.colorHex, textColorHex: updated.textColorHex },
        });
        return updated;
    }
    async removeType(id, user) {
        this.assertEditorAccess(user);
        const existing = await this.prisma.lessonLearnedType.findUnique({
            where: { id },
        });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
        const inUse = await this.prisma.lessonLearnedPost.count({
            where: { typeId: id },
        });
        if (inUse > 0) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
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
    assertViewerAccess(user) {
        if (!(0, role_access_1.hasAnyRole)(user, [
            role_access_1.ROLE_COORDENACAO_CIPAVD,
            role_access_1.ROLE_TI,
            role_access_1.ROLE_COMANDANTE_COMGEP,
        ])) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
    assertEditorAccess(user) {
        if (!(0, role_access_1.hasAnyRole)(user, [role_access_1.ROLE_COORDENACAO_CIPAVD, role_access_1.ROLE_TI])) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
    normalizeRequiredText(value, field, maxLength) {
        const normalized = (0, sanitize_1.sanitizeText)(value);
        if (!normalized) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field, reason: 'required' });
        }
        if (normalized.length > maxLength) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field, reason: 'too_long' });
        }
        return normalized;
    }
    buildAuthorLabel(user) {
        const raw = (0, sanitize_1.sanitizeText)(user?.name ?? '');
        if (!raw)
            return 'Coordenação CIPAVD';
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
    async resolveTypeId(typeId) {
        const normalized = String(typeId ?? '').trim();
        if (!normalized) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field: 'typeId', reason: 'required' });
        }
        const existing = await this.prisma.lessonLearnedType.findUnique({
            where: { id: normalized },
            select: { id: true },
        });
        if (!existing) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field: 'typeId', reason: 'invalid' });
        }
        return existing.id;
    }
    normalizeColorHex(value) {
        const normalized = String(value ?? '').trim().toUpperCase();
        if (!/^#[0-9A-F]{6}$/.test(normalized)) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field: 'colorHex', reason: 'invalid' });
        }
        return normalized;
    }
};
exports.LessonsLearnedService = LessonsLearnedService;
exports.LessonsLearnedService = LessonsLearnedService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], LessonsLearnedService);
//# sourceMappingURL=lessons-learned.service.js.map