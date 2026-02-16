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
exports.PostosController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const require_permission_decorator_1 = require("../rbac/require-permission.decorator");
const rbac_guard_1 = require("../rbac/rbac.guard");
const prisma_service_1 = require("../prisma/prisma.service");
const sanitize_1 = require("../common/sanitize");
const create_posto_dto_1 = require("./dto/create-posto.dto");
const update_posto_dto_1 = require("./dto/update-posto.dto");
let PostosController = class PostosController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list() {
        const items = await this.prisma.posto.findMany({ orderBy: { sortOrder: 'asc' } });
        return { items };
    }
    async create(dto) {
        return this.prisma.posto.create({
            data: {
                code: (0, sanitize_1.sanitizeText)(dto.code).toUpperCase(),
                name: (0, sanitize_1.sanitizeText)(dto.name),
                sortOrder: dto.sortOrder ?? 0,
            },
        });
    }
    async update(id, dto) {
        return this.prisma.posto.update({
            where: { id },
            data: {
                code: dto.code ? (0, sanitize_1.sanitizeText)(dto.code).toUpperCase() : undefined,
                name: dto.name ? (0, sanitize_1.sanitizeText)(dto.name) : undefined,
                sortOrder: dto.sortOrder ?? undefined,
            },
        });
    }
    async remove(id) {
        await this.prisma.posto.delete({ where: { id } });
        return { ok: true };
    }
};
exports.PostosController = PostosController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('postos', 'view'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PostosController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)('postos', 'create'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_posto_dto_1.CreatePostoDto]),
    __metadata("design:returntype", Promise)
], PostosController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('postos', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_posto_dto_1.UpdatePostoDto]),
    __metadata("design:returntype", Promise)
], PostosController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('postos', 'delete'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PostosController.prototype, "remove", null);
exports.PostosController = PostosController = __decorate([
    (0, common_1.Controller)('postos'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PostosController);
//# sourceMappingURL=postos.controller.js.map