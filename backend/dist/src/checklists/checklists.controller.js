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
exports.ChecklistItemStatusController = exports.ChecklistsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../common/current-user.decorator");
const require_permission_decorator_1 = require("../rbac/require-permission.decorator");
const rbac_guard_1 = require("../rbac/rbac.guard");
const create_checklist_dto_1 = require("./dto/create-checklist.dto");
const create_checklist_item_dto_1 = require("./dto/create-checklist-item.dto");
const update_checklist_status_dto_1 = require("./dto/update-checklist-status.dto");
const checklists_service_1 = require("./checklists.service");
let ChecklistsController = class ChecklistsController {
    checklists;
    constructor(checklists) {
        this.checklists = checklists;
    }
    list(phaseId, specialtyId, eloRoleId, user) {
        return this.checklists.list({ phaseId, specialtyId, eloRoleId }, user);
    }
    create(dto, user) {
        return this.checklists.create(dto, user);
    }
    addItem(id, dto, user) {
        return this.checklists.addItem(id, dto, user);
    }
};
exports.ChecklistsController = ChecklistsController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('checklists', 'view'),
    __param(0, (0, common_1.Query)('phaseId')),
    __param(1, (0, common_1.Query)('specialtyId')),
    __param(2, (0, common_1.Query)('eloRoleId')),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], ChecklistsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)('checklists', 'create'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_checklist_dto_1.CreateChecklistDto, Object]),
    __metadata("design:returntype", void 0)
], ChecklistsController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id/items'),
    (0, require_permission_decorator_1.RequirePermission)('checklists', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_checklist_item_dto_1.CreateChecklistItemDto, Object]),
    __metadata("design:returntype", void 0)
], ChecklistsController.prototype, "addItem", null);
exports.ChecklistsController = ChecklistsController = __decorate([
    (0, common_1.Controller)('checklists'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [checklists_service_1.ChecklistsService])
], ChecklistsController);
let ChecklistItemStatusController = class ChecklistItemStatusController {
    checklists;
    constructor(checklists) {
        this.checklists = checklists;
    }
    batch(dto, user) {
        return this.checklists.updateStatuses(dto.updates, user);
    }
};
exports.ChecklistItemStatusController = ChecklistItemStatusController;
__decorate([
    (0, common_1.Put)('batch'),
    (0, require_permission_decorator_1.RequirePermission)('checklists', 'update'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_checklist_status_dto_1.UpdateChecklistStatusDto, Object]),
    __metadata("design:returntype", void 0)
], ChecklistItemStatusController.prototype, "batch", null);
exports.ChecklistItemStatusController = ChecklistItemStatusController = __decorate([
    (0, common_1.Controller)('checklist-item-status'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [checklists_service_1.ChecklistsService])
], ChecklistItemStatusController);
//# sourceMappingURL=checklists.controller.js.map