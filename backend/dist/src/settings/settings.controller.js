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
exports.SettingsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const rbac_guard_1 = require("../rbac/rbac.guard");
const require_permission_decorator_1 = require("../rbac/require-permission.decorator");
const settings_service_1 = require("./settings.service");
const litellm_service_1 = require("../llm/litellm.service");
let SettingsController = class SettingsController {
    settings;
    litellm;
    constructor(settings, litellm) {
        this.settings = settings;
        this.litellm = litellm;
    }
    async getAiSettings() {
        return this.settings.getAiSettings();
    }
    async updateAiSettings(body) {
        await this.settings.updateAiSettings(body);
        return { ok: true };
    }
    async testLitellmConnection() {
        return this.litellm.testConnection();
    }
};
exports.SettingsController = SettingsController;
__decorate([
    (0, common_1.Get)('ai-settings'),
    (0, require_permission_decorator_1.RequirePermission)('admin_rbac', 'update'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getAiSettings", null);
__decorate([
    (0, common_1.Put)('ai-settings'),
    (0, require_permission_decorator_1.RequirePermission)('admin_rbac', 'update'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateAiSettings", null);
__decorate([
    (0, common_1.Get)('ai-settings/test'),
    (0, require_permission_decorator_1.RequirePermission)('admin_rbac', 'update'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "testLitellmConnection", null);
exports.SettingsController = SettingsController = __decorate([
    (0, common_1.Controller)('admin'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [settings_service_1.SettingsService,
        litellm_service_1.LitellmService])
], SettingsController);
//# sourceMappingURL=settings.controller.js.map