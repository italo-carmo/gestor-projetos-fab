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
exports.RolesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const require_permission_decorator_1 = require("./require-permission.decorator");
const rbac_guard_1 = require("./rbac.guard");
const rbac_service_1 = require("./rbac.service");
const role_dto_1 = require("./dto/role.dto");
const role_permissions_dto_1 = require("./dto/role-permissions.dto");
let RolesController = class RolesController {
    rbac;
    constructor(rbac) {
        this.rbac = rbac;
    }
    async list() {
        const roles = await this.rbac.listRoles();
        return { items: roles };
    }
    create(dto) {
        return this.rbac.createRole({
            name: dto.name,
            description: dto.description ?? null,
            isSystemRole: dto.isSystemRole ?? false,
            wildcard: dto.wildcard ?? false,
        });
    }
    update(id, dto) {
        return this.rbac.updateRole(id, {
            name: dto.name,
            description: dto.description ?? null,
            isSystemRole: dto.isSystemRole ?? undefined,
            wildcard: dto.wildcard ?? undefined,
        });
    }
    async remove(id) {
        await this.rbac.deleteRole(id);
    }
    clone(id, body) {
        return this.rbac.cloneRole(id, body?.name, body?.description);
    }
    setPermissions(id, dto) {
        return this.rbac.setRolePermissions(id, dto.permissions);
    }
};
exports.RolesController = RolesController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('roles', 'view'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RolesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)('roles', 'create'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [role_dto_1.RoleDto]),
    __metadata("design:returntype", void 0)
], RolesController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('roles', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, role_dto_1.RoleDto]),
    __metadata("design:returntype", void 0)
], RolesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('roles', 'delete'),
    (0, common_1.HttpCode)(204),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RolesController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/clone'),
    (0, require_permission_decorator_1.RequirePermission)('roles', 'clone'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], RolesController.prototype, "clone", null);
__decorate([
    (0, common_1.Put)(':id/permissions'),
    (0, require_permission_decorator_1.RequirePermission)('roles', 'permissions'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, role_permissions_dto_1.RolePermissionsDto]),
    __metadata("design:returntype", void 0)
], RolesController.prototype, "setPermissions", null);
exports.RolesController = RolesController = __decorate([
    (0, common_1.Controller)('roles'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [rbac_service_1.RbacService])
], RolesController);
//# sourceMappingURL=roles.controller.js.map