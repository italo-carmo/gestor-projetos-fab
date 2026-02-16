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
exports.ElosService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const http_error_1 = require("../common/http-error");
const sanitize_1 = require("../common/sanitize");
const audit_service_1 = require("../audit/audit.service");
const pagination_1 = require("../common/pagination");
let ElosService = class ElosService {
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
        if (filters.eloRoleId)
            where.eloRoleId = filters.eloRoleId;
        if (filters.roleType)
            where.eloRole = { code: filters.roleType };
        const constraints = this.getScopeConstraints(user);
        if (constraints.localityId)
            where.localityId = constraints.localityId;
        const { page, pageSize, skip, take } = (0, pagination_1.parsePagination)(filters.page, filters.pageSize);
        const [items, total] = await this.prisma.$transaction([
            this.prisma.elo.findMany({
                where,
                include: { locality: true, eloRole: true },
                orderBy: [{ locality: { name: 'asc' } }, { eloRole: { sortOrder: 'asc' } }],
                skip,
                take,
            }),
            this.prisma.elo.count({ where }),
        ]);
        return {
            items: items.map((item) => this.mapElo(item, user?.executiveHidePii)),
            page,
            pageSize,
            total,
            executive_hide_pii: user?.executiveHidePii ?? false,
        };
    }
    async create(payload, user) {
        this.assertConstraints(payload.localityId, user);
        const created = await this.prisma.elo.create({
            data: {
                localityId: payload.localityId,
                eloRoleId: payload.eloRoleId,
                name: (0, sanitize_1.sanitizeText)(payload.name),
                rank: payload.rank ? (0, sanitize_1.sanitizeText)(payload.rank) : null,
                phone: payload.phone ? (0, sanitize_1.sanitizeText)(payload.phone) : null,
                email: payload.email ? (0, sanitize_1.sanitizeText)(payload.email) : null,
                om: payload.om ? (0, sanitize_1.sanitizeText)(payload.om) : null,
            },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'elos',
            action: 'create',
            entityId: created.id,
            localityId: created.localityId,
            diffJson: { eloRoleId: created.eloRoleId, name: created.name },
        });
        return this.mapElo(created, user?.executiveHidePii);
    }
    async update(id, payload, user) {
        const existing = await this.prisma.elo.findUnique({ where: { id } });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
        const localityId = payload.localityId ?? existing.localityId;
        this.assertConstraints(localityId, user);
        const updated = await this.prisma.elo.update({
            where: { id },
            data: {
                localityId,
                eloRoleId: payload.eloRoleId ?? undefined,
                name: payload.name ? (0, sanitize_1.sanitizeText)(payload.name) : undefined,
                rank: payload.rank ? (0, sanitize_1.sanitizeText)(payload.rank) : payload.rank === null ? null : undefined,
                phone: payload.phone ? (0, sanitize_1.sanitizeText)(payload.phone) : payload.phone === null ? null : undefined,
                email: payload.email ? (0, sanitize_1.sanitizeText)(payload.email) : payload.email === null ? null : undefined,
                om: payload.om ? (0, sanitize_1.sanitizeText)(payload.om) : payload.om === null ? null : undefined,
            },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'elos',
            action: 'update',
            entityId: id,
            localityId: updated.localityId,
        });
        return this.mapElo(updated, user?.executiveHidePii);
    }
    async remove(id, user) {
        const existing = await this.prisma.elo.findUnique({ where: { id } });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
        this.assertConstraints(existing.localityId, user);
        await this.prisma.elo.delete({ where: { id } });
        await this.audit.log({
            userId: user?.id,
            resource: 'elos',
            action: 'delete',
            entityId: id,
            localityId: existing.localityId,
        });
        return { ok: true };
    }
    async orgChart(filters, user) {
        const where = {};
        if (filters.localityId)
            where.localityId = filters.localityId;
        if (filters.eloRoleId)
            where.eloRoleId = filters.eloRoleId;
        if (filters.roleType)
            where.eloRole = { code: filters.roleType };
        const constraints = this.getScopeConstraints(user);
        if (constraints.localityId)
            where.localityId = constraints.localityId;
        const items = await this.prisma.elo.findMany({
            where,
            include: { locality: true, eloRole: true },
            orderBy: [{ locality: { name: 'asc' } }, { eloRole: { sortOrder: 'asc' } }],
        });
        const grouped = {};
        for (const item of items) {
            const localityName = item.locality?.name ?? item.localityId;
            if (!grouped[localityName])
                grouped[localityName] = [];
            grouped[localityName].push(this.mapElo(item, user?.executiveHidePii));
        }
        return {
            items: Object.entries(grouped).map(([localityName, elos]) => ({
                localityName,
                elos,
            })),
            executive_hide_pii: user?.executiveHidePii ?? false,
        };
    }
    getScopeConstraints(user) {
        if (!user)
            return {};
        return {
            localityId: user.localityId ?? undefined,
        };
    }
    assertConstraints(localityId, user) {
        const constraints = this.getScopeConstraints(user);
        if (constraints.localityId && constraints.localityId !== localityId) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
    mapElo(item, executiveHidePii) {
        if (!executiveHidePii)
            return item;
        const { phone, email, name, rank, ...rest } = item;
        return rest;
    }
};
exports.ElosService = ElosService;
exports.ElosService = ElosService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], ElosService);
//# sourceMappingURL=elos.service.js.map