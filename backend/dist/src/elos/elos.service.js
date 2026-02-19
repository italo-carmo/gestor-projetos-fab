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
const role_access_1 = require("../rbac/role-access");
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
        const linkedUser = payload.userId
            ? await this.assertUserMatchesAssignment(payload.userId, payload.localityId, payload.eloRoleId)
            : null;
        const nameFromPayload = String(payload.name ?? '').trim();
        const resolvedName = linkedUser?.name ?? nameFromPayload;
        if (!resolvedName) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'NAME_REQUIRED' });
        }
        const created = await this.prisma.elo.create({
            data: {
                localityId: payload.localityId,
                eloRoleId: payload.eloRoleId,
                name: (0, sanitize_1.sanitizeText)(resolvedName),
                rank: payload.rank ? (0, sanitize_1.sanitizeText)(payload.rank) : null,
                phone: payload.phone ? (0, sanitize_1.sanitizeText)(payload.phone) : null,
                email: linkedUser?.email ?? (payload.email ? (0, sanitize_1.sanitizeText)(payload.email) : null),
                om: payload.om ? (0, sanitize_1.sanitizeText)(payload.om) : null,
            },
            include: { locality: true, eloRole: true },
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
        const eloRoleId = payload.eloRoleId ?? existing.eloRoleId;
        this.assertConstraints(localityId, user);
        const linkedUser = payload.userId
            ? await this.assertUserMatchesAssignment(payload.userId, localityId, eloRoleId)
            : null;
        const resolvedName = linkedUser
            ? linkedUser.name
            : payload.name
                ? (0, sanitize_1.sanitizeText)(payload.name)
                : undefined;
        const resolvedEmail = linkedUser
            ? linkedUser.email
            : payload.email
                ? (0, sanitize_1.sanitizeText)(payload.email)
                : payload.email === null
                    ? null
                    : undefined;
        const updated = await this.prisma.elo.update({
            where: { id },
            data: {
                localityId,
                eloRoleId: payload.eloRoleId ?? undefined,
                name: resolvedName,
                rank: payload.rank ? (0, sanitize_1.sanitizeText)(payload.rank) : payload.rank === null ? null : undefined,
                phone: payload.phone ? (0, sanitize_1.sanitizeText)(payload.phone) : payload.phone === null ? null : undefined,
                email: resolvedEmail,
                om: payload.om ? (0, sanitize_1.sanitizeText)(payload.om) : payload.om === null ? null : undefined,
            },
            include: { locality: true, eloRole: true },
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
        const userWhere = {
            isActive: true,
            localityId: { not: null },
            eloRoleId: { not: null },
        };
        if (filters.localityId)
            userWhere.localityId = filters.localityId;
        if (filters.eloRoleId)
            userWhere.eloRoleId = filters.eloRoleId;
        if (filters.roleType)
            userWhere.eloRole = { code: filters.roleType };
        if (constraints.localityId)
            userWhere.localityId = constraints.localityId;
        const [items, candidates] = await this.prisma.$transaction([
            this.prisma.elo.findMany({
                where,
                include: { locality: true, eloRole: true },
                orderBy: [{ locality: { name: 'asc' } }, { eloRole: { sortOrder: 'asc' } }],
            }),
            this.prisma.user.findMany({
                where: userWhere,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    localityId: true,
                    eloRoleId: true,
                    locality: { select: { id: true, name: true, code: true } },
                    eloRole: { select: { id: true, code: true, name: true, sortOrder: true } },
                },
                orderBy: [{ locality: { name: 'asc' } }, { eloRole: { sortOrder: 'asc' } }, { name: 'asc' }],
            }),
        ]);
        const existingKeySet = new Set();
        for (const item of items) {
            existingKeySet.add(this.buildEloMatchKey(item.localityId, item.eloRoleId, item.name, item.email));
        }
        const grouped = new Map();
        for (const item of items) {
            const localityName = item.locality?.name ?? item.localityId;
            const localityCode = item.locality?.code ?? '';
            const key = item.localityId;
            if (!grouped.has(key)) {
                grouped.set(key, {
                    localityId: item.localityId,
                    localityName,
                    localityCode,
                    elos: [],
                });
            }
            grouped.get(key).elos.push(this.mapElo({ ...item, autoFromUser: false }, user?.executiveHidePii));
        }
        for (const candidate of candidates) {
            if (!candidate.localityId || !candidate.eloRoleId)
                continue;
            const candidateKey = this.buildEloMatchKey(candidate.localityId, candidate.eloRoleId, candidate.name, candidate.email);
            if (existingKeySet.has(candidateKey))
                continue;
            const groupKey = candidate.localityId;
            if (!grouped.has(groupKey)) {
                grouped.set(groupKey, {
                    localityId: candidate.localityId,
                    localityName: candidate.locality?.name ?? candidate.localityId,
                    localityCode: candidate.locality?.code ?? '',
                    elos: [],
                });
            }
            grouped.get(groupKey).elos.push(this.mapElo({
                id: `auto-user-${candidate.id}`,
                localityId: candidate.localityId,
                eloRoleId: candidate.eloRoleId,
                eloRole: candidate.eloRole,
                locality: candidate.locality,
                name: candidate.name,
                email: candidate.email,
                rank: null,
                phone: null,
                om: null,
                autoFromUser: true,
                source: 'USER_ALLOCATION',
                systemUser: {
                    id: candidate.id,
                    name: candidate.name,
                    email: candidate.email,
                },
            }, user?.executiveHidePii));
        }
        return {
            items: Array.from(grouped.values()),
            executive_hide_pii: user?.executiveHidePii ?? false,
        };
    }
    async listOrgChartCandidates(filters, user) {
        const where = {
            isActive: true,
            localityId: { not: null },
            eloRoleId: { not: null },
        };
        if (filters.localityId)
            where.localityId = filters.localityId;
        if (filters.eloRoleId)
            where.eloRoleId = filters.eloRoleId;
        if (filters.q) {
            where.OR = [
                { name: { contains: filters.q, mode: 'insensitive' } },
                { email: { contains: filters.q, mode: 'insensitive' } },
            ];
        }
        const constraints = this.getScopeConstraints(user);
        if (constraints.localityId)
            where.localityId = constraints.localityId;
        const items = await this.prisma.user.findMany({
            where,
            select: {
                id: true,
                name: true,
                email: true,
                localityId: true,
                eloRoleId: true,
                locality: { select: { id: true, name: true, code: true } },
                eloRole: { select: { id: true, code: true, name: true } },
            },
            orderBy: [{ name: 'asc' }],
            take: 300,
        });
        return { items };
    }
    async createOrgChartAssignment(payload, user) {
        this.assertCanManageOrgChart(user);
        return this.create({
            localityId: payload.localityId,
            eloRoleId: payload.eloRoleId,
            userId: payload.userId,
            name: '',
            rank: payload.rank ?? null,
            phone: payload.phone ?? null,
            om: payload.om ?? null,
        }, user);
    }
    async updateOrgChartAssignment(id, payload, user) {
        this.assertCanManageOrgChart(user);
        return this.update(id, {
            localityId: payload.localityId,
            eloRoleId: payload.eloRoleId,
            userId: payload.userId,
            rank: payload.rank,
            phone: payload.phone,
            om: payload.om,
        }, user);
    }
    async removeOrgChartAssignment(id, user) {
        this.assertCanManageOrgChart(user);
        return this.remove(id, user);
    }
    getScopeConstraints(user) {
        if (!user)
            return {};
        if ((0, role_access_1.isNationalCommissionMember)(user))
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
    assertCanManageOrgChart(user) {
        if (!(0, role_access_1.isNationalCommissionMember)(user)) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
    async assertUserMatchesAssignment(userId, localityId, eloRoleId) {
        const linkedUser = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                isActive: true,
                localityId: true,
                eloRoleId: true,
            },
        });
        if (!linkedUser || !linkedUser.isActive) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'ORG_CHART_USER_INVALID' });
        }
        if (!linkedUser.localityId || linkedUser.localityId !== localityId) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                reason: 'ORG_CHART_USER_LOCALITY_MISMATCH',
                userId,
                localityId,
            });
        }
        if (!linkedUser.eloRoleId || linkedUser.eloRoleId !== eloRoleId) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                reason: 'ORG_CHART_USER_ROLE_MISMATCH',
                userId,
                eloRoleId,
            });
        }
        return linkedUser;
    }
    buildEloMatchKey(localityId, eloRoleId, name, email) {
        const nameKey = String(name ?? '').trim().toLowerCase();
        const emailKey = String(email ?? '').trim().toLowerCase();
        return `${localityId}:${eloRoleId}:${nameKey}:${emailKey}`;
    }
    mapElo(item, executiveHidePii) {
        if (!executiveHidePii)
            return item;
        const { phone, email, name, rank, systemUser, source, ...rest } = item;
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