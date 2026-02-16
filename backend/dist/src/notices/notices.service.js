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
exports.NoticesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const http_error_1 = require("../common/http-error");
const sanitize_1 = require("../common/sanitize");
const pagination_1 = require("../common/pagination");
let NoticesService = class NoticesService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async list(filters, user) {
        const where = {};
        if (filters.localityId)
            where.localityId = filters.localityId;
        if (filters.specialtyId)
            where.specialtyId = filters.specialtyId;
        if (filters.pinned !== undefined)
            where.pinned = filters.pinned === 'true';
        if (filters.priority)
            where.priority = filters.priority;
        if (filters.dueFrom || filters.dueTo) {
            where.dueDate = {};
            if (filters.dueFrom)
                where.dueDate.gte = new Date(filters.dueFrom);
            if (filters.dueTo)
                where.dueDate.lte = new Date(filters.dueTo);
        }
        const constraints = this.getScopeConstraints(user);
        const scopeFilters = [];
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
        const { page, pageSize, skip, take } = (0, pagination_1.parsePagination)(filters.page, filters.pageSize);
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
    async create(payload, user) {
        const localityId = payload.localityId ?? null;
        const specialtyId = payload.specialtyId ?? null;
        this.assertConstraints(localityId, specialtyId, user);
        const created = await this.prisma.notice.create({
            data: {
                title: (0, sanitize_1.sanitizeText)(payload.title),
                body: (0, sanitize_1.sanitizeText)(payload.body),
                localityId,
                specialtyId,
                dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
                priority: payload.priority ?? client_1.NoticePriority.MEDIUM,
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
    async update(id, payload, user) {
        const existing = await this.prisma.notice.findUnique({ where: { id } });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
        const localityId = payload.localityId ?? existing.localityId ?? null;
        const specialtyId = payload.specialtyId ?? existing.specialtyId ?? null;
        this.assertConstraints(localityId, specialtyId, user);
        const updated = await this.prisma.notice.update({
            where: { id },
            data: {
                title: payload.title ? (0, sanitize_1.sanitizeText)(payload.title) : undefined,
                body: payload.body ? (0, sanitize_1.sanitizeText)(payload.body) : undefined,
                localityId,
                specialtyId,
                dueDate: payload.dueDate ? new Date(payload.dueDate) : payload.dueDate === null ? null : undefined,
                priority: payload.priority ? payload.priority : undefined,
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
    async remove(id, user) {
        const existing = await this.prisma.notice.findUnique({ where: { id } });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
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
    async pin(id, pinned, user) {
        const existing = await this.prisma.notice.findUnique({ where: { id } });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
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
    getScopeConstraints(user) {
        if (!user)
            return {};
        return {
            localityId: user.localityId ?? undefined,
            specialtyId: user.specialtyId ?? undefined,
        };
    }
    assertConstraints(localityId, specialtyId, user) {
        const constraints = this.getScopeConstraints(user);
        if (constraints.localityId && constraints.localityId !== localityId) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
        if (constraints.specialtyId && constraints.specialtyId !== specialtyId) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
};
exports.NoticesService = NoticesService;
exports.NoticesService = NoticesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], NoticesService);
//# sourceMappingURL=notices.service.js.map