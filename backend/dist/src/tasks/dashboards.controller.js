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
exports.DashboardsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../common/current-user.decorator");
const require_permission_decorator_1 = require("../rbac/require-permission.decorator");
const rbac_guard_1 = require("../rbac/rbac.guard");
const tasks_service_1 = require("./tasks.service");
let DashboardsController = class DashboardsController {
    tasks;
    constructor(tasks) {
        this.tasks = tasks;
    }
    progress(id, user) {
        return this.tasks.getLocalityProgress(id, user);
    }
    national(user) {
        return this.tasks.getDashboardNational(user);
    }
    recruits(user) {
        return this.tasks.getDashboardRecruits(user);
    }
    executive(from, to, phaseId, threshold, command, user) {
        return this.tasks.getDashboardExecutive({ from, to, phaseId, threshold, command }, user);
    }
};
exports.DashboardsController = DashboardsController;
__decorate([
    (0, common_1.Get)('localities/:id/progress'),
    (0, require_permission_decorator_1.RequirePermission)('dashboard', 'view'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], DashboardsController.prototype, "progress", null);
__decorate([
    (0, common_1.Get)('dashboard/national'),
    (0, require_permission_decorator_1.RequirePermission)('dashboard', 'view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DashboardsController.prototype, "national", null);
__decorate([
    (0, common_1.Get)('dashboard/recruits'),
    (0, require_permission_decorator_1.RequirePermission)('dashboard', 'view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DashboardsController.prototype, "recruits", null);
__decorate([
    (0, common_1.Get)('dashboard/executive'),
    (0, require_permission_decorator_1.RequirePermission)('dashboard', 'view'),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __param(2, (0, common_1.Query)('phaseId')),
    __param(3, (0, common_1.Query)('threshold')),
    __param(4, (0, common_1.Query)('command')),
    __param(5, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], DashboardsController.prototype, "executive", null);
exports.DashboardsController = DashboardsController = __decorate([
    (0, common_1.Controller)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [tasks_service_1.TasksService])
], DashboardsController);
//# sourceMappingURL=dashboards.controller.js.map