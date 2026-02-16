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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalitiesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../common/current-user.decorator");
const http_error_1 = require("../common/http-error");
const require_permission_decorator_1 = require("../rbac/require-permission.decorator");
const rbac_guard_1 = require("../rbac/rbac.guard");
const prisma_service_1 = require("../prisma/prisma.service");
const sanitize_1 = require("../common/sanitize");
const create_locality_dto_1 = require("./dto/create-locality.dto");
const update_locality_recruits_dto_1 = require("./dto/update-locality-recruits.dto");
const update_locality_dto_1 = require("./dto/update-locality.dto");
let LocalitiesController = class LocalitiesController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(user) {
        const where = user?.localityId ? { id: user.localityId } : undefined;
        const items = await this.prisma.locality.findMany({ where, orderBy: { name: 'asc' } });
        return { items };
    }
    async create(dto) {
        return this.prisma.locality.create({
            data: {
                code: (0, sanitize_1.sanitizeText)(dto.code),
                name: (0, sanitize_1.sanitizeText)(dto.name),
                commandName: dto.commandName ? (0, sanitize_1.sanitizeText)(dto.commandName) : null,
                commanderName: dto.commanderName ? (0, sanitize_1.sanitizeText)(dto.commanderName) : null,
                individualMeetingDate: dto.individualMeetingDate ? new Date(dto.individualMeetingDate) : null,
                visitDate: dto.visitDate ? new Date(dto.visitDate) : null,
                recruitsFemaleCountCurrent: dto.recruitsFemaleCountCurrent ?? null,
                notes: dto.notes ? (0, sanitize_1.sanitizeText)(dto.notes) : null,
            },
        });
    }
    async update(id, dto, user) {
        this.assertLocalityAccess(id, user);
        const updated = await this.prisma.locality.update({
            where: { id },
            data: {
                code: dto.code ? (0, sanitize_1.sanitizeText)(dto.code) : undefined,
                name: dto.name ? (0, sanitize_1.sanitizeText)(dto.name) : undefined,
                commandName: dto.commandName ? (0, sanitize_1.sanitizeText)(dto.commandName) : dto.commandName === null ? null : undefined,
                commanderName: dto.commanderName ? (0, sanitize_1.sanitizeText)(dto.commanderName) : dto.commanderName === null ? null : undefined,
                individualMeetingDate: dto.individualMeetingDate ? new Date(dto.individualMeetingDate) : dto.individualMeetingDate === null ? null : undefined,
                visitDate: dto.visitDate ? new Date(dto.visitDate) : dto.visitDate === null ? null : undefined,
                recruitsFemaleCountCurrent: dto.recruitsFemaleCountCurrent ?? undefined,
                notes: dto.notes ? (0, sanitize_1.sanitizeText)(dto.notes) : dto.notes === null ? null : undefined,
            },
        });
        if (dto.recruitsFemaleCountCurrent !== undefined && dto.recruitsFemaleCountCurrent !== null) {
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            await this.prisma.recruitsHistory.upsert({
                where: {
                    localityId_date: { localityId: id, date: today },
                },
                create: {
                    localityId: id,
                    date: today,
                    recruitsFemaleCount: dto.recruitsFemaleCountCurrent,
                    turnoverCount: 0,
                },
                update: {
                    recruitsFemaleCount: dto.recruitsFemaleCountCurrent,
                },
            });
        }
        return updated;
    }
    async updateRecruits(id, dto, user) {
        if (!user?.localityId)
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        this.assertLocalityAccess(id, user);
        const updated = await this.prisma.locality.update({
            where: { id },
            data: {
                recruitsFemaleCountCurrent: dto.recruitsFemaleCountCurrent,
            },
        });
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        await this.prisma.recruitsHistory.upsert({
            where: {
                localityId_date: { localityId: id, date: today },
            },
            create: {
                localityId: id,
                date: today,
                recruitsFemaleCount: dto.recruitsFemaleCountCurrent,
                turnoverCount: 0,
            },
            update: {
                recruitsFemaleCount: dto.recruitsFemaleCountCurrent,
            },
        });
        return updated;
    }
    async remove(id) {
        await this.prisma.locality.delete({ where: { id } });
        return { ok: true };
    }
    assertLocalityAccess(localityId, user) {
        if (!user?.localityId)
            return;
        if (user.localityId !== localityId) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
};
exports.LocalitiesController = LocalitiesController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('localities', 'view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], LocalitiesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)('localities', 'create'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_locality_dto_1.CreateLocalityDto]),
    __metadata("design:returntype", Promise)
], LocalitiesController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('localities', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_locality_dto_1.UpdateLocalityDto, Object]),
    __metadata("design:returntype", Promise)
], LocalitiesController.prototype, "update", null);
__decorate([
    (0, common_1.Put)(':id/recruits'),
    (0, require_permission_decorator_1.RequirePermission)('dashboard', 'view'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_locality_recruits_dto_1.UpdateLocalityRecruitsDto, Object]),
    __metadata("design:returntype", Promise)
], LocalitiesController.prototype, "updateRecruits", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('localities', 'delete'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], LocalitiesController.prototype, "remove", null);
exports.LocalitiesController = LocalitiesController = __decorate([
    (0, common_1.Controller)('localities'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LocalitiesController);
//# sourceMappingURL=localities.controller.js.map