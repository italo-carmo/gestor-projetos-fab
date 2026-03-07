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
exports.LessonsLearnedController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../common/current-user.decorator");
const require_permission_decorator_1 = require("../rbac/require-permission.decorator");
const rbac_guard_1 = require("../rbac/rbac.guard");
const create_lesson_learned_dto_1 = require("./dto/create-lesson-learned.dto");
const create_lesson_learned_type_dto_1 = require("./dto/create-lesson-learned-type.dto");
const list_lesson_learned_dto_1 = require("./dto/list-lesson-learned.dto");
const update_lesson_learned_dto_1 = require("./dto/update-lesson-learned.dto");
const update_lesson_learned_type_dto_1 = require("./dto/update-lesson-learned-type.dto");
const lessons_learned_service_1 = require("./lessons-learned.service");
let LessonsLearnedController = class LessonsLearnedController {
    lessons;
    constructor(lessons) {
        this.lessons = lessons;
    }
    list(query, user) {
        return this.lessons.list(query, user);
    }
    listTypes(user) {
        return this.lessons.listTypes(user);
    }
    create(dto, user) {
        return this.lessons.create(dto, user);
    }
    createType(dto, user) {
        return this.lessons.createType(dto, user);
    }
    update(id, dto, user) {
        return this.lessons.update(id, dto, user);
    }
    updateType(id, dto, user) {
        return this.lessons.updateType(id, dto, user);
    }
    remove(id, user) {
        return this.lessons.remove(id, user);
    }
    removeType(id, user) {
        return this.lessons.removeType(id, user);
    }
};
exports.LessonsLearnedController = LessonsLearnedController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('lessons_learned', 'view'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_lesson_learned_dto_1.ListLessonLearnedDto, Object]),
    __metadata("design:returntype", void 0)
], LessonsLearnedController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('types'),
    (0, require_permission_decorator_1.RequirePermission)('lessons_learned', 'view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LessonsLearnedController.prototype, "listTypes", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)('lessons_learned', 'create'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_lesson_learned_dto_1.CreateLessonLearnedDto, Object]),
    __metadata("design:returntype", void 0)
], LessonsLearnedController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('types'),
    (0, require_permission_decorator_1.RequirePermission)('lessons_learned', 'create'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_lesson_learned_type_dto_1.CreateLessonLearnedTypeDto, Object]),
    __metadata("design:returntype", void 0)
], LessonsLearnedController.prototype, "createType", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('lessons_learned', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_lesson_learned_dto_1.UpdateLessonLearnedDto, Object]),
    __metadata("design:returntype", void 0)
], LessonsLearnedController.prototype, "update", null);
__decorate([
    (0, common_1.Put)('types/:id'),
    (0, require_permission_decorator_1.RequirePermission)('lessons_learned', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_lesson_learned_type_dto_1.UpdateLessonLearnedTypeDto, Object]),
    __metadata("design:returntype", void 0)
], LessonsLearnedController.prototype, "updateType", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('lessons_learned', 'delete'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], LessonsLearnedController.prototype, "remove", null);
__decorate([
    (0, common_1.Delete)('types/:id'),
    (0, require_permission_decorator_1.RequirePermission)('lessons_learned', 'delete'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], LessonsLearnedController.prototype, "removeType", null);
exports.LessonsLearnedController = LessonsLearnedController = __decorate([
    (0, common_1.Controller)('lessons-learned'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [lessons_learned_service_1.LessonsLearnedService])
], LessonsLearnedController);
//# sourceMappingURL=lessons-learned.controller.js.map