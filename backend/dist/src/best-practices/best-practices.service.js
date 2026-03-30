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
exports.BestPracticesService = void 0;
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../audit/audit.service");
const http_error_1 = require("../common/http-error");
const sanitize_1 = require("../common/sanitize");
const prisma_service_1 = require("../prisma/prisma.service");
const role_access_1 = require("../rbac/role-access");
let BestPracticesService = class BestPracticesService {
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
                { locality: { name: { contains: q, mode: 'insensitive' } } },
            ];
        }
        if (filters.localityId) {
            if (filters.localityId === '__commission__') {
                where.isCommission = true;
            }
            else {
                where.localityId = filters.localityId;
            }
        }
        if (filters.typeId) {
            where.typeId = String(filters.typeId).trim();
        }
        try {
            const items = await this.prisma.bestPracticePost.findMany({
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
        }
        catch {
            const legacyItems = await this.prisma.bestPracticePost.findMany({
                where,
                include: {
                    locality: { select: { id: true, name: true, code: true } },
                    createdBy: { select: { id: true, name: true } },
                },
                orderBy: [{ isCommission: 'desc' }, { createdAt: 'desc' }],
            });
            return {
                items: legacyItems.map((item) => ({ ...item, type: null })),
            };
        }
    }
    async listTypes(user) {
        this.assertViewerAccess(user);
        if (!this.prisma.bestPracticeType) {
            return { items: [] };
        }
        const items = await this.prisma.bestPracticeType.findMany({
            orderBy: [{ name: 'asc' }],
        });
        return { items };
    }
    async create(payload, user) {
        this.assertCreatorAccess(user);
        const title = this.normalizeRequiredText(payload.title, 'title', 140);
        const content = this.normalizeRequiredText(payload.content, 'content', 1200);
        const isCommission = Boolean(payload.isCommission);
        const localityId = this.resolveLocalityTarget(payload.localityId, isCommission);
        const typeId = await this.resolveTypeTarget(payload.typeId);
        const created = await this.prisma.bestPracticePost.create({
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
    async update(id, payload, user) {
        this.assertUpdaterAccess(user);
        const existing = await this.prisma.bestPracticePost.findUnique({
            where: { id },
        });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
        const nextIsCommission = payload.isCommission !== undefined
            ? Boolean(payload.isCommission)
            : existing.isCommission;
        const nextLocalityId = this.resolveLocalityTarget(payload.localityId !== undefined
            ? payload.localityId
            : existing.localityId, nextIsCommission);
        const nextTypeId = payload.typeId !== undefined
            ? await this.resolveTypeTarget(payload.typeId)
            : (existing.typeId ?? null);
        const updated = await this.prisma.bestPracticePost.update({
            where: { id },
            data: {
                title: payload.title !== undefined
                    ? this.normalizeRequiredText(payload.title, 'title', 140)
                    : undefined,
                content: payload.content !== undefined
                    ? this.normalizeRequiredText(payload.content, 'content', 1200)
                    : undefined,
                isCommission: payload.isCommission !== undefined
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
    async remove(id, user) {
        this.assertDeleteAccess(user);
        const existing = await this.prisma.bestPracticePost.findUnique({
            where: { id },
        });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
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
    assertViewerAccess(user) {
        if (!(0, role_access_1.hasAnyRole)(user, [
            role_access_1.ROLE_COORDENACAO_CIPAVD,
            role_access_1.ROLE_TI,
            role_access_1.ROLE_COMANDANTE_COMGEP,
        ])) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
    assertUpdaterAccess(user) {
        if (!(0, role_access_1.hasAnyRole)(user, [role_access_1.ROLE_COORDENACAO_CIPAVD, role_access_1.ROLE_TI])) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
    assertDeleteAccess(user) {
        if (!(0, role_access_1.hasRole)(user, role_access_1.ROLE_COORDENACAO_CIPAVD)) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
    assertCreatorAccess(user) {
        if (!(0, role_access_1.hasAnyRole)(user, [role_access_1.ROLE_COORDENACAO_CIPAVD, role_access_1.ROLE_TI])) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
    async resolveTypeTarget(typeId) {
        const id = String(typeId ?? '').trim();
        if (!id)
            return null;
        if (!this.prisma.bestPracticeType) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'typeId',
                reason: 'feature_unavailable',
            });
        }
        const found = await this.prisma.bestPracticeType.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!found) {
            (0, http_error_1.throwError)('NOT_FOUND');
        }
        return id;
    }
    resolveLocalityTarget(localityId, isCommission) {
        if (isCommission)
            return null;
        const id = String(localityId ?? '').trim();
        if (!id) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'localityId',
                reason: 'required_for_locality_post',
            });
        }
        return id;
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
    async createType(payload, user) {
        this.assertTypeEditorAccess(user);
        if (!this.prisma.bestPracticeType) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'type',
                reason: 'feature_unavailable',
            });
        }
        const normalized = this.normalizeRequiredText(payload.name, 'name', 80);
        const colorHex = this.normalizeColorHex(payload.colorHex);
        const textColorHex = payload.textColorHex
            ? this.normalizeColorHex(payload.textColorHex)
            : '#FFFFFF';
        const existing = await this.prisma.bestPracticeType.findFirst({
            where: { name: { equals: normalized, mode: 'insensitive' } },
            select: { id: true, name: true },
        });
        if (existing) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field: 'name', reason: 'duplicate' });
        }
        const created = await this.prisma.bestPracticeType.create({
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
    async updateType(id, payload, user) {
        this.assertTypeEditorAccess(user);
        if (!this.prisma.bestPracticeType) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'type',
                reason: 'feature_unavailable',
            });
        }
        const existing = await this.prisma.bestPracticeType.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
        const updateData = {};
        if (payload.name !== undefined) {
            const normalized = this.normalizeRequiredText(payload.name, 'name', 80);
            const duplicate = await this.prisma.bestPracticeType.findFirst({
                where: {
                    name: { equals: normalized, mode: 'insensitive' },
                    id: { not: id },
                },
                select: { id: true },
            });
            if (duplicate) {
                (0, http_error_1.throwError)('VALIDATION_ERROR', { field: 'name', reason: 'duplicate' });
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
        const updated = await this.prisma.bestPracticeType.update({
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
    async removeType(id, user) {
        this.assertTypeEditorAccess(user);
        if (!this.prisma.bestPracticeType) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'type',
                reason: 'feature_unavailable',
            });
        }
        const existing = await this.prisma.bestPracticeType.findUnique({
            where: { id },
            select: { id: true, name: true },
        });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
        const inUse = await this.prisma.bestPracticePost.findFirst({
            where: { typeId: id },
            select: { id: true },
        });
        if (inUse) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field: 'id', reason: 'in_use' });
        }
        await this.prisma.bestPracticeType.delete({ where: { id } });
        await this.audit.log({
            userId: user?.id,
            resource: 'best_practice_types',
            action: 'delete',
            entityId: existing.id,
            diffJson: { name: existing.name },
        });
        return { ok: true };
    }
    assertTypeEditorAccess(user) {
        if (!(0, role_access_1.hasAnyRole)(user, [role_access_1.ROLE_COORDENACAO_CIPAVD, role_access_1.ROLE_TI])) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
    normalizeColorHex(value) {
        const hex = String(value).trim();
        if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'colorHex',
                reason: 'invalid_format',
            });
        }
        return hex.toUpperCase();
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
};
exports.BestPracticesService = BestPracticesService;
exports.BestPracticesService = BestPracticesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], BestPracticesService);
//# sourceMappingURL=best-practices.service.js.map