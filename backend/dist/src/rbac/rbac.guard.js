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
exports.RbacGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const require_permission_decorator_1 = require("./require-permission.decorator");
const rbac_service_1 = require("./rbac.service");
const http_error_1 = require("../common/http-error");
let RbacGuard = class RbacGuard {
    reflector;
    rbac;
    constructor(reflector, rbac) {
        this.reflector = reflector;
        this.rbac = rbac;
    }
    async canActivate(context) {
        const requirement = this.reflector.get(require_permission_decorator_1.PERMISSION_METADATA_KEY, context.getHandler());
        const request = context.switchToHttp().getRequest();
        const userId = request.user?.userId;
        if (!userId) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
        const access = await this.rbac.getUserAccess(userId);
        request.rbacUser = access;
        if (!requirement) {
            return true;
        }
        const { resource, action, scope } = requirement;
        const wildcard = access.roles.some((role) => role.wildcard);
        if (wildcard)
            return true;
        const allowed = access.roles.some((role) => role.permissions.some((perm) => {
            if (perm.resource !== resource && perm.resource !== '*')
                return false;
            if (perm.action !== action && perm.action !== '*')
                return false;
            if (scope && perm.scope !== scope)
                return false;
            return true;
        }));
        if (!allowed) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
        return true;
    }
};
exports.RbacGuard = RbacGuard;
exports.RbacGuard = RbacGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector, rbac_service_1.RbacService])
], RbacGuard);
//# sourceMappingURL=rbac.guard.js.map