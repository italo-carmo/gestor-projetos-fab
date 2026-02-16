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
exports.AuditService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const pagination_1 = require("../common/pagination");
let AuditService = class AuditService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async log(params) {
        const diffJson = params.diffJson ? this.truncateDiff(params.diffJson) : client_1.Prisma.JsonNull;
        return this.prisma.auditLog.create({
            data: {
                userId: params.userId ?? null,
                localityId: params.localityId ?? null,
                resource: params.resource,
                action: params.action,
                entityId: params.entityId ?? null,
                diffJson: diffJson,
            },
        });
    }
    truncateDiff(diff) {
        const raw = JSON.stringify(diff);
        if (raw.length <= 2000)
            return diff;
        return { truncated: raw.slice(0, 2000) };
    }
    async list(filters) {
        const where = {};
        if (filters.resource)
            where.resource = filters.resource;
        if (filters.userId)
            where.userId = filters.userId;
        if (filters.localityId)
            where.localityId = filters.localityId;
        if (filters.entityId)
            where.entityId = filters.entityId;
        if (filters.from || filters.to) {
            where.createdAt = {};
            if (filters.from)
                where.createdAt.gte = new Date(filters.from);
            if (filters.to)
                where.createdAt.lte = new Date(filters.to);
        }
        const { page, pageSize, skip, take } = (0, pagination_1.parsePagination)(filters.page, filters.pageSize);
        const [items, total] = await this.prisma.$transaction([
            this.prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                include: { user: true, locality: true },
                skip,
                take,
            }),
            this.prisma.auditLog.count({ where }),
        ]);
        return { items, page, pageSize, total };
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuditService);
//# sourceMappingURL=audit.service.js.map