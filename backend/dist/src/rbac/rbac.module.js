"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RbacModule = void 0;
const common_1 = require("@nestjs/common");
const rbac_service_1 = require("./rbac.service");
const roles_controller_1 = require("./roles.controller");
const permissions_controller_1 = require("./permissions.controller");
const admin_rbac_controller_1 = require("./admin-rbac.controller");
const rbac_guard_1 = require("./rbac.guard");
let RbacModule = class RbacModule {
};
exports.RbacModule = RbacModule;
exports.RbacModule = RbacModule = __decorate([
    (0, common_1.Module)({
        controllers: [roles_controller_1.RolesController, permissions_controller_1.PermissionsController, admin_rbac_controller_1.AdminRbacController],
        providers: [rbac_service_1.RbacService, rbac_guard_1.RbacGuard],
        exports: [rbac_service_1.RbacService, rbac_guard_1.RbacGuard],
    })
], RbacModule);
//# sourceMappingURL=rbac.module.js.map