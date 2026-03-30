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
exports.SmifComplaintsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../audit/audit.service");
const http_error_1 = require("../common/http-error");
const sanitize_1 = require("../common/sanitize");
const prisma_service_1 = require("../prisma/prisma.service");
const role_access_1 = require("../rbac/role-access");
let SmifComplaintsService = class SmifComplaintsService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async list(filters, user) {
        this.assertEditorAccess(user);
        const where = {};
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
    async create(payload, user) {
        this.assertEditorAccess(user);
        const actorId = this.resolveActorId(user);
        const localityId = await this.resolveLocalityId(payload.localityId);
        const reportedAt = this.normalizeDate(payload.reportedAt, 'reportedAt');
        const description = this.normalizeRequiredText(payload.description, 'description', 4000);
        const status = payload.status ?? client_1.SmifComplaintStatus.IN_PROGRESS;
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
    async update(id, payload, user) {
        this.assertEditorAccess(user);
        const actorId = this.resolveActorId(user);
        const existing = await this.prisma.smifComplaint.findUnique({
            where: { id },
        });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
        const localityId = payload.localityId !== undefined
            ? await this.resolveLocalityId(payload.localityId)
            : undefined;
        const reportedAt = payload.reportedAt !== undefined
            ? this.normalizeDate(payload.reportedAt, 'reportedAt')
            : undefined;
        const description = payload.description !== undefined
            ? this.normalizeRequiredText(payload.description, 'description', 4000)
            : undefined;
        const conclusion = payload.conclusion !== undefined
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
    async remove(id, user) {
        this.assertEditorAccess(user);
        const existing = await this.prisma.smifComplaint.findUnique({
            where: { id },
            select: { id: true, localityId: true, reportedAt: true, status: true },
        });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
        await this.prisma.smifComplaint.delete({ where: { id } });
        await this.audit.log({
            userId: user?.id,
            resource: 'smif_complaints',
            action: 'delete',
            entityId: existing.id,
            localityId: existing.localityId,
            diffJson: {
                localityId: existing.localityId,
                reportedAt: existing.reportedAt,
                status: existing.status,
            },
        });
        return { ok: true };
    }
    assertEditorAccess(user) {
        if (!(0, role_access_1.hasAnyRole)(user, [role_access_1.ROLE_COORDENACAO_CIPAVD, role_access_1.ROLE_TI])) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
    resolveActorId(user) {
        const id = String(user?.id ?? '').trim();
        if (!id) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
        return id;
    }
    normalizeDate(value, field) {
        const date = new Date(value);
        if (!Number.isFinite(date.getTime())) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field, reason: 'invalid_date' });
        }
        return date;
    }
    normalizeRequiredText(value, field, maxLength) {
        const normalized = (0, sanitize_1.sanitizeText)(value ?? '');
        if (!normalized) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field, reason: 'required' });
        }
        if (normalized.length > maxLength) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field, reason: 'too_long' });
        }
        return normalized;
    }
    normalizeOptionalText(value, maxLength) {
        if (value === undefined)
            return undefined;
        const normalized = (0, sanitize_1.sanitizeText)(value ?? '');
        if (!normalized)
            return null;
        if (normalized.length > maxLength) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'conclusion',
                reason: 'too_long',
            });
        }
        return normalized;
    }
    async resolveLocalityId(localityId) {
        const id = String(localityId ?? '').trim();
        if (!id) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'localityId',
                reason: 'required',
            });
        }
        const exists = await this.prisma.locality.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!exists) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'localityId',
                reason: 'not_found',
            });
        }
        return id;
    }
};
exports.SmifComplaintsService = SmifComplaintsService;
exports.SmifComplaintsService = SmifComplaintsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], SmifComplaintsService);
//# sourceMappingURL=smif-complaints.service.js.map