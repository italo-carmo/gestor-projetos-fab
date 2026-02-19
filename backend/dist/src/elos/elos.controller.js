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
exports.OrgChartController = exports.ElosController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../common/current-user.decorator");
const require_permission_decorator_1 = require("../rbac/require-permission.decorator");
const rbac_guard_1 = require("../rbac/rbac.guard");
const elos_service_1 = require("./elos.service");
const create_elo_dto_1 = require("./dto/create-elo.dto");
const update_elo_dto_1 = require("./dto/update-elo.dto");
const create_org_chart_assignment_dto_1 = require("./dto/create-org-chart-assignment.dto");
const update_org_chart_assignment_dto_1 = require("./dto/update-org-chart-assignment.dto");
let ElosController = class ElosController {
    elos;
    constructor(elos) {
        this.elos = elos;
    }
    list(localityId, roleType, page, pageSize, user) {
        return this.elos.list({ localityId, roleType, page, pageSize }, user);
    }
    create(dto, user) {
        return this.elos.create(dto, user);
    }
    update(id, dto, user) {
        return this.elos.update(id, dto, user);
    }
    remove(id, user) {
        return this.elos.remove(id, user);
    }
};
exports.ElosController = ElosController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('elos', 'view'),
    __param(0, (0, common_1.Query)('localityId')),
    __param(1, (0, common_1.Query)('roleType')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('pageSize')),
    __param(4, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], ElosController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)('elos', 'create'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_elo_dto_1.CreateEloDto, Object]),
    __metadata("design:returntype", void 0)
], ElosController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('elos', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_elo_dto_1.UpdateEloDto, Object]),
    __metadata("design:returntype", void 0)
], ElosController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('elos', 'delete'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ElosController.prototype, "remove", null);
exports.ElosController = ElosController = __decorate([
    (0, common_1.Controller)('elos'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [elos_service_1.ElosService])
], ElosController);
let OrgChartController = class OrgChartController {
    elos;
    constructor(elos) {
        this.elos = elos;
    }
    orgChart(localityId, roleType, user) {
        return this.elos.orgChart({ localityId, roleType }, user);
    }
    candidates(localityId, eloRoleId, q, user) {
        return this.elos.listOrgChartCandidates({ localityId, eloRoleId, q }, user);
    }
    createAssignment(dto, user) {
        return this.elos.createOrgChartAssignment(dto, user);
    }
    updateAssignment(id, dto, user) {
        return this.elos.updateOrgChartAssignment(id, dto, user);
    }
    removeAssignment(id, user) {
        return this.elos.removeOrgChartAssignment(id, user);
    }
};
exports.OrgChartController = OrgChartController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('org_chart', 'view'),
    __param(0, (0, common_1.Query)('localityId')),
    __param(1, (0, common_1.Query)('roleType')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", void 0)
], OrgChartController.prototype, "orgChart", null);
__decorate([
    (0, common_1.Get)('candidates'),
    (0, require_permission_decorator_1.RequirePermission)('org_chart', 'view'),
    __param(0, (0, common_1.Query)('localityId')),
    __param(1, (0, common_1.Query)('eloRoleId')),
    __param(2, (0, common_1.Query)('q')),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], OrgChartController.prototype, "candidates", null);
__decorate([
    (0, common_1.Post)('assignments'),
    (0, require_permission_decorator_1.RequirePermission)('org_chart', 'view'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_org_chart_assignment_dto_1.CreateOrgChartAssignmentDto, Object]),
    __metadata("design:returntype", void 0)
], OrgChartController.prototype, "createAssignment", null);
__decorate([
    (0, common_1.Put)('assignments/:id'),
    (0, require_permission_decorator_1.RequirePermission)('org_chart', 'view'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_org_chart_assignment_dto_1.UpdateOrgChartAssignmentDto, Object]),
    __metadata("design:returntype", void 0)
], OrgChartController.prototype, "updateAssignment", null);
__decorate([
    (0, common_1.Delete)('assignments/:id'),
    (0, require_permission_decorator_1.RequirePermission)('org_chart', 'view'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], OrgChartController.prototype, "removeAssignment", null);
exports.OrgChartController = OrgChartController = __decorate([
    (0, common_1.Controller)('org-chart'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [elos_service_1.ElosService])
], OrgChartController);
//# sourceMappingURL=elos.controller.js.map