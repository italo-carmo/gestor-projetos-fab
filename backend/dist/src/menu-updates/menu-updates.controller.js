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
exports.MenuUpdatesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../common/current-user.decorator");
const rbac_guard_1 = require("../rbac/rbac.guard");
const menu_updates_service_1 = require("./menu-updates.service");
let MenuUpdatesController = class MenuUpdatesController {
    menuUpdates;
    constructor(menuUpdates) {
        this.menuUpdates = menuUpdates;
    }
    list(menuKeys, user) {
        return this.menuUpdates.list(menuKeys, user);
    }
    markSeen(menuKey, user) {
        return this.menuUpdates.markSeen(menuKey, user);
    }
};
exports.MenuUpdatesController = MenuUpdatesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('menuKeys')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], MenuUpdatesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(':menuKey/seen'),
    __param(0, (0, common_1.Param)('menuKey')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MenuUpdatesController.prototype, "markSeen", null);
exports.MenuUpdatesController = MenuUpdatesController = __decorate([
    (0, common_1.Controller)('menu-updates'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [menu_updates_service_1.MenuUpdatesService])
], MenuUpdatesController);
//# sourceMappingURL=menu-updates.controller.js.map