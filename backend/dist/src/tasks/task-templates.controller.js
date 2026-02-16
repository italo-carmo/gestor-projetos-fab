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
exports.TaskTemplatesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../common/current-user.decorator");
const require_permission_decorator_1 = require("../rbac/require-permission.decorator");
const rbac_guard_1 = require("../rbac/rbac.guard");
const generate_instances_dto_1 = require("./dto/generate-instances.dto");
const task_template_dto_1 = require("./dto/task-template.dto");
const tasks_service_1 = require("./tasks.service");
let TaskTemplatesController = class TaskTemplatesController {
    tasks;
    constructor(tasks) {
        this.tasks = tasks;
    }
    async list() {
        const items = await this.tasks.listTaskTemplates();
        return { items };
    }
    create(dto, user) {
        return this.tasks.createTaskTemplate({
            title: dto.title,
            description: dto.description ?? null,
            phase: { connect: { id: dto.phaseId } },
            specialty: dto.specialtyId ? { connect: { id: dto.specialtyId } } : undefined,
            eloRole: dto.eloRoleId ? { connect: { id: dto.eloRoleId } } : undefined,
            appliesToAllLocalities: dto.appliesToAllLocalities,
            reportRequiredDefault: dto.reportRequiredDefault,
        }, user);
    }
    generateInstances(id, dto, user) {
        return this.tasks.generateInstances(id, {
            localities: dto.localities,
            reportRequired: dto.reportRequired,
            priority: dto.priority,
            meetingId: dto.meetingId ?? null,
            assignedToId: dto.assignedToId ?? null,
        }, user);
    }
    clone(id, user) {
        return this.tasks.cloneTaskTemplate(id, user);
    }
};
exports.TaskTemplatesController = TaskTemplatesController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('task_templates', 'view'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TaskTemplatesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)('task_templates', 'create'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [task_template_dto_1.TaskTemplateDto, Object]),
    __metadata("design:returntype", void 0)
], TaskTemplatesController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id/generate-instances'),
    (0, require_permission_decorator_1.RequirePermission)('task_templates', 'create'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, generate_instances_dto_1.GenerateInstancesDto, Object]),
    __metadata("design:returntype", void 0)
], TaskTemplatesController.prototype, "generateInstances", null);
__decorate([
    (0, common_1.Post)(':id/clone'),
    (0, require_permission_decorator_1.RequirePermission)('task_templates', 'create'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TaskTemplatesController.prototype, "clone", null);
exports.TaskTemplatesController = TaskTemplatesController = __decorate([
    (0, common_1.Controller)('task-templates'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [tasks_service_1.TasksService])
], TaskTemplatesController);
//# sourceMappingURL=task-templates.controller.js.map