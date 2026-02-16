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
exports.SpecialtiesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const require_permission_decorator_1 = require("../rbac/require-permission.decorator");
const rbac_guard_1 = require("../rbac/rbac.guard");
const prisma_service_1 = require("../prisma/prisma.service");
const sanitize_1 = require("../common/sanitize");
const create_specialty_dto_1 = require("./dto/create-specialty.dto");
const update_specialty_dto_1 = require("./dto/update-specialty.dto");
let SpecialtiesController = class SpecialtiesController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list() {
        const items = await this.prisma.specialty.findMany({ orderBy: { name: 'asc' } });
        return { items };
    }
    async create(dto) {
        return this.prisma.specialty.create({
            data: {
                name: (0, sanitize_1.sanitizeText)(dto.name),
                color: dto.color ? (0, sanitize_1.sanitizeText)(dto.color) : null,
                icon: dto.icon ? (0, sanitize_1.sanitizeText)(dto.icon) : null,
            },
        });
    }
    async update(id, dto) {
        return this.prisma.specialty.update({
            where: { id },
            data: {
                name: dto.name ? (0, sanitize_1.sanitizeText)(dto.name) : undefined,
                color: dto.color ? (0, sanitize_1.sanitizeText)(dto.color) : dto.color === null ? null : undefined,
                icon: dto.icon ? (0, sanitize_1.sanitizeText)(dto.icon) : dto.icon === null ? null : undefined,
            },
        });
    }
    async remove(id) {
        await this.prisma.specialty.delete({ where: { id } });
        return { ok: true };
    }
};
exports.SpecialtiesController = SpecialtiesController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('specialties', 'view'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SpecialtiesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)('specialties', 'create'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_specialty_dto_1.CreateSpecialtyDto]),
    __metadata("design:returntype", Promise)
], SpecialtiesController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('specialties', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_specialty_dto_1.UpdateSpecialtyDto]),
    __metadata("design:returntype", Promise)
], SpecialtiesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('specialties', 'delete'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SpecialtiesController.prototype, "remove", null);
exports.SpecialtiesController = SpecialtiesController = __decorate([
    (0, common_1.Controller)('specialties'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SpecialtiesController);
//# sourceMappingURL=specialties.controller.js.map