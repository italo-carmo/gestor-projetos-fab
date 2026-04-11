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
exports.BestPracticesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../common/current-user.decorator");
const require_permission_decorator_1 = require("../rbac/require-permission.decorator");
const rbac_guard_1 = require("../rbac/rbac.guard");
const best_practices_service_1 = require("./best-practices.service");
const create_best_practice_dto_1 = require("./dto/create-best-practice.dto");
const list_best_practice_dto_1 = require("./dto/list-best-practice.dto");
const update_best_practice_dto_1 = require("./dto/update-best-practice.dto");
const create_best_practice_type_dto_1 = require("./dto/create-best-practice-type.dto");
const update_best_practice_type_dto_1 = require("./dto/update-best-practice-type.dto");
let BestPracticesController = class BestPracticesController {
    bestPractices;
    constructor(bestPractices) {
        this.bestPractices = bestPractices;
    }
    list(query, user) {
        return this.bestPractices.list(query, user);
    }
    create(dto, user) {
        return this.bestPractices.create(dto, user);
    }
    update(id, dto, user) {
        return this.bestPractices.update(id, dto, user);
    }
    remove(id, user) {
        return this.bestPractices.remove(id, user);
    }
    listTypes(user) {
        return this.bestPractices.listTypes(user);
    }
    createType(dto, user) {
        return this.bestPractices.createType(dto, user);
    }
    updateType(id, dto, user) {
        return this.bestPractices.updateType(id, dto, user);
    }
    removeType(id, user) {
        return this.bestPractices.removeType(id, user);
    }
};
exports.BestPracticesController = BestPracticesController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('best_practices', 'view'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_best_practice_dto_1.ListBestPracticeDto, Object]),
    __metadata("design:returntype", void 0)
], BestPracticesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)('best_practices', 'create'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_best_practice_dto_1.CreateBestPracticeDto, Object]),
    __metadata("design:returntype", void 0)
], BestPracticesController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('best_practices', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_best_practice_dto_1.UpdateBestPracticeDto, Object]),
    __metadata("design:returntype", void 0)
], BestPracticesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('best_practices', 'delete'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], BestPracticesController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)('types'),
    (0, require_permission_decorator_1.RequirePermission)('best_practice_types', 'view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BestPracticesController.prototype, "listTypes", null);
__decorate([
    (0, common_1.Post)('types'),
    (0, require_permission_decorator_1.RequirePermission)('best_practice_types', 'create'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_best_practice_type_dto_1.CreateBestPracticeTypeDto, Object]),
    __metadata("design:returntype", void 0)
], BestPracticesController.prototype, "createType", null);
__decorate([
    (0, common_1.Put)('types/:id'),
    (0, require_permission_decorator_1.RequirePermission)('best_practice_types', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_best_practice_type_dto_1.UpdateBestPracticeTypeDto, Object]),
    __metadata("design:returntype", void 0)
], BestPracticesController.prototype, "updateType", null);
__decorate([
    (0, common_1.Delete)('types/:id'),
    (0, require_permission_decorator_1.RequirePermission)('best_practice_types', 'delete'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], BestPracticesController.prototype, "removeType", null);
exports.BestPracticesController = BestPracticesController = __decorate([
    (0, common_1.Controller)('best-practices'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [best_practices_service_1.BestPracticesService])
], BestPracticesController);
//# sourceMappingURL=best-practices.controller.js.map