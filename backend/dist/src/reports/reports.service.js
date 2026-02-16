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
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const http_error_1 = require("../common/http-error");
const audit_service_1 = require("../audit/audit.service");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
let ReportsService = class ReportsService {
    prisma;
    audit;
    jwt;
    config;
    constructor(prisma, audit, jwt, config) {
        this.prisma = prisma;
        this.audit = audit;
        this.jwt = jwt;
        this.config = config;
    }
    async createReport(params, user) {
        const instance = await this.prisma.taskInstance.findUnique({
            where: { id: params.taskInstanceId },
            include: { taskTemplate: { select: { specialtyId: true } } },
        });
        if (!instance)
            (0, http_error_1.throwError)('NOT_FOUND');
        if (user?.localityId && user.localityId !== instance.localityId) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
        if (user?.specialtyId && user.specialtyId !== instance.taskTemplate?.specialtyId) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
        const report = await this.prisma.report.create({
            data: {
                taskInstanceId: params.taskInstanceId,
                fileName: params.fileName,
                fileUrl: params.fileUrl,
                storageKey: params.storageKey ?? null,
                mimeType: params.mimeType ?? null,
                fileSize: params.fileSize ?? null,
                checksum: params.checksum ?? null,
            },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'reports',
            action: 'upload',
            entityId: report.id,
            localityId: instance.localityId,
            diffJson: { taskInstanceId: params.taskInstanceId },
        });
        return report;
    }
    async getReport(id, user) {
        const report = await this.prisma.report.findUnique({ where: { id } });
        if (!report)
            (0, http_error_1.throwError)('NOT_FOUND');
        if (user?.localityId || user?.specialtyId) {
            const instance = await this.prisma.taskInstance.findUnique({
                where: { id: report.taskInstanceId },
                include: { taskTemplate: { select: { specialtyId: true } } },
            });
            if (instance && user?.localityId && instance.localityId !== user.localityId) {
                (0, http_error_1.throwError)('RBAC_FORBIDDEN');
            }
            if (instance && user?.specialtyId && instance.taskTemplate?.specialtyId !== user.specialtyId) {
                (0, http_error_1.throwError)('RBAC_FORBIDDEN');
            }
        }
        return report;
    }
    async getSignedUrl(id, user) {
        if (user?.executiveHidePii && this.config.get('REPORTS_ALLOW_EXEC_DOWNLOAD') !== 'true') {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
        const report = await this.getReport(id, user);
        const secret = this.config.get('REPORTS_SIGNED_URL_SECRET') ?? this.config.get('JWT_ACCESS_SECRET');
        const ttl = this.config.get('REPORTS_SIGNED_URL_TTL') ?? '600s';
        const token = await this.jwt.signAsync({ rid: report.id }, { secret, expiresIn: ttl });
        return { url: `/reports/${report.id}/download?token=${token}`, expiresIn: ttl };
    }
    async verifyDownloadToken(token) {
        const secret = this.config.get('REPORTS_SIGNED_URL_SECRET') ?? this.config.get('JWT_ACCESS_SECRET');
        try {
            const payload = await this.jwt.verifyAsync(token, { secret });
            return payload.rid;
        }
        catch {
            (0, http_error_1.throwError)('AUTH_INVALID_CREDENTIALS');
        }
    }
    async approveReport(id, approved, user) {
        const report = await this.prisma.report.findUnique({ where: { id } });
        if (!report)
            (0, http_error_1.throwError)('NOT_FOUND');
        let instance = null;
        if (user?.localityId || user?.specialtyId) {
            instance = await this.prisma.taskInstance.findUnique({
                where: { id: report.taskInstanceId },
                include: { taskTemplate: { select: { specialtyId: true } } },
            });
            if (instance && user?.localityId && instance.localityId !== user.localityId) {
                (0, http_error_1.throwError)('RBAC_FORBIDDEN');
            }
            if (instance && user?.specialtyId && instance.taskTemplate?.specialtyId !== user.specialtyId) {
                (0, http_error_1.throwError)('RBAC_FORBIDDEN');
            }
        }
        const updated = await this.prisma.report.update({ where: { id }, data: { approved } });
        await this.audit.log({
            userId: user?.id,
            resource: 'reports',
            action: 'approve',
            entityId: id,
            localityId: instance?.localityId ?? undefined,
            diffJson: { approved },
        });
        return updated;
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        jwt_1.JwtService,
        config_1.ConfigService])
], ReportsService);
//# sourceMappingURL=reports.service.js.map