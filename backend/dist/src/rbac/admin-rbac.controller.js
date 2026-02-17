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
exports.AdminRbacController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../common/current-user.decorator");
const require_permission_decorator_1 = require("./require-permission.decorator");
const rbac_guard_1 = require("./rbac.guard");
const rbac_service_1 = require("./rbac.service");
const throttler_1 = require("@nestjs/throttler");
const set_user_module_access_dto_1 = require("./dto/set-user-module-access.dto");
let AdminRbacController = class AdminRbacController {
    rbac;
    constructor(rbac) {
        this.rbac = rbac;
    }
    export() {
        return this.rbac.exportMatrix();
    }
    import(body, user, mode) {
        return this.rbac.importMatrix(body, mode ?? 'replace', user?.id);
    }
    simulate(userId, roleId) {
        return this.rbac.simulateAccess({ userId, roleId });
    }
    userModuleAccess(userId) {
        return this.rbac.getUserModuleAccess(userId);
    }
    setUserModuleAccess(userId, dto, user) {
        return this.rbac.setUserModuleAccess(userId, { resource: dto.resource, enabled: dto.enabled }, user?.id);
    }
};
exports.AdminRbacController = AdminRbacController;
__decorate([
    (0, common_1.Get)('export'),
    (0, require_permission_decorator_1.RequirePermission)('admin_rbac', 'export'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminRbacController.prototype, "export", null);
__decorate([
    (0, common_1.Post)('import'),
    (0, require_permission_decorator_1.RequirePermission)('admin_rbac', 'import'),
    (0, common_1.UseGuards)(throttler_1.ThrottlerGuard),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60_000 } }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Query)('mode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", void 0)
], AdminRbacController.prototype, "import", null);
__decorate([
    (0, common_1.Get)('simulate'),
    (0, require_permission_decorator_1.RequirePermission)('admin_rbac', 'export'),
    __param(0, (0, common_1.Query)('userId')),
    __param(1, (0, common_1.Query)('roleId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminRbacController.prototype, "simulate", null);
__decorate([
    (0, common_1.Get)('user-module-access/:userId'),
    (0, require_permission_decorator_1.RequirePermission)('users', 'view'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminRbacController.prototype, "userModuleAccess", null);
__decorate([
    (0, common_1.Put)('user-module-access/:userId'),
    (0, require_permission_decorator_1.RequirePermission)('users', 'update'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, set_user_module_access_dto_1.SetUserModuleAccessDto, Object]),
    __metadata("design:returntype", void 0)
], AdminRbacController.prototype, "setUserModuleAccess", null);
exports.AdminRbacController = AdminRbacController = __decorate([
    (0, common_1.Controller)('admin/rbac'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [rbac_service_1.RbacService])
], AdminRbacController);
//# sourceMappingURL=admin-rbac.controller.js.map