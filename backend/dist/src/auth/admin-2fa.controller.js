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
exports.Admin2faController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("./jwt-auth.guard");
const rbac_guard_1 = require("../rbac/rbac.guard");
const require_permission_decorator_1 = require("../rbac/require-permission.decorator");
const auth_service_1 = require("./auth.service");
let Admin2faController = class Admin2faController {
    auth;
    constructor(auth) {
        this.auth = auth;
    }
    resetTwoFactor(id) {
        return this.auth.resetTwoFactor(id);
    }
    twoFactorStatus(id) {
        return this.auth.getUserTwoFactorStatus(id);
    }
};
exports.Admin2faController = Admin2faController;
__decorate([
    (0, common_1.Post)('users/:id/reset-2fa'),
    (0, require_permission_decorator_1.RequirePermission)('users', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], Admin2faController.prototype, "resetTwoFactor", null);
__decorate([
    (0, common_1.Get)('users/:id/2fa-status'),
    (0, require_permission_decorator_1.RequirePermission)('users', 'view'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], Admin2faController.prototype, "twoFactorStatus", null);
exports.Admin2faController = Admin2faController = __decorate([
    (0, common_1.Controller)('admin/rbac'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], Admin2faController);
//# sourceMappingURL=admin-2fa.controller.js.map