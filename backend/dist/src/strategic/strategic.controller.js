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
exports.StrategicController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const rbac_guard_1 = require("../rbac/rbac.guard");
const require_permission_decorator_1 = require("../rbac/require-permission.decorator");
const strategic_service_1 = require("./strategic.service");
let StrategicController = class StrategicController {
    service;
    constructor(service) {
        this.service = service;
    }
    dashboard() {
        return this.service.situationalDashboard();
    }
    aggressorProfile() {
        return this.service.aggressorProfile();
    }
    textAnalysis() {
        return this.service.textAnalysis();
    }
    geoMap() {
        return this.service.geoMap();
    }
    getAiNarrative() {
        return this.service.strategicAiNarrative();
    }
    postAiNarrative() {
        return this.service.strategicAiNarrative();
    }
    async executiveReportPdf(res) {
        const buffer = await this.service.executiveReportPdf();
        const filename = `relatorio-executivo-${new Date().toISOString().slice(0, 10)}.pdf`;
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': buffer.length,
        });
        res.end(buffer);
    }
};
exports.StrategicController = StrategicController;
__decorate([
    (0, common_1.Get)('dashboard'),
    (0, require_permission_decorator_1.RequirePermission)('bi', 'view'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StrategicController.prototype, "dashboard", null);
__decorate([
    (0, common_1.Get)('aggressor-profile'),
    (0, require_permission_decorator_1.RequirePermission)('bi', 'view'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StrategicController.prototype, "aggressorProfile", null);
__decorate([
    (0, common_1.Get)('text-analysis'),
    (0, require_permission_decorator_1.RequirePermission)('bi', 'view'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StrategicController.prototype, "textAnalysis", null);
__decorate([
    (0, common_1.Get)('geo-map'),
    (0, require_permission_decorator_1.RequirePermission)('bi', 'view'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StrategicController.prototype, "geoMap", null);
__decorate([
    (0, common_1.Get)('ai-narrative'),
    (0, require_permission_decorator_1.RequirePermission)('bi', 'view'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StrategicController.prototype, "getAiNarrative", null);
__decorate([
    (0, common_1.Post)('ai-narrative'),
    (0, require_permission_decorator_1.RequirePermission)('bi', 'view'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StrategicController.prototype, "postAiNarrative", null);
__decorate([
    (0, common_1.Get)('executive-report/pdf'),
    (0, require_permission_decorator_1.RequirePermission)('bi', 'view'),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StrategicController.prototype, "executiveReportPdf", null);
exports.StrategicController = StrategicController = __decorate([
    (0, common_1.Controller)('strategic'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [strategic_service_1.StrategicService])
], StrategicController);
//# sourceMappingURL=strategic.controller.js.map