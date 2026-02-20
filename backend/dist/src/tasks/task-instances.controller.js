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
exports.TaskInstancesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../common/current-user.decorator");
const require_permission_decorator_1 = require("../rbac/require-permission.decorator");
const rbac_guard_1 = require("../rbac/rbac.guard");
const task_assign_dto_1 = require("./dto/task-assign.dto");
const task_comment_dto_1 = require("./dto/task-comment.dto");
const task_elo_role_dto_1 = require("./dto/task-elo-role.dto");
const task_meeting_dto_1 = require("./dto/task-meeting.dto");
const task_progress_dto_1 = require("./dto/task-progress.dto");
const task_specialty_dto_1 = require("./dto/task-specialty.dto");
const task_status_dto_1 = require("./dto/task-status.dto");
const tasks_service_1 = require("./tasks.service");
let TaskInstancesController = class TaskInstancesController {
    tasks;
    constructor(tasks) {
        this.tasks = tasks;
    }
    listAssignees(localityId, user) {
        return this.tasks.listAssignees(localityId, user);
    }
    list(localityId, phaseId, status, assigneeId, assigneeIds, dueFrom, dueTo, meetingId, eloRoleId, specialtyId, page, pageSize, user) {
        return this.tasks.listTaskInstances({
            localityId,
            phaseId,
            status,
            assigneeId,
            assigneeIds,
            dueFrom,
            dueTo,
            meetingId,
            eloRoleId,
            specialtyId,
            page,
            pageSize,
        }, user);
    }
    comments(id, user) {
        return this.tasks.listComments(id, user);
    }
    addComment(id, dto, user) {
        return this.tasks.addComment(id, dto.text, user);
    }
    markCommentsSeen(id, user) {
        return this.tasks.markCommentsSeen(id, user);
    }
    updateStatus(id, dto, user) {
        return this.tasks.updateStatus(id, dto.status, user);
    }
    updateProgress(id, dto, user) {
        return this.tasks.updateProgress(id, dto.progressPercent, user);
    }
    assign(id, dto, user) {
        return this.tasks.assignTask(id, dto, user);
    }
    updateMeeting(id, dto, user) {
        return this.tasks.updateTaskMeeting(id, dto.meetingId ?? null, user);
    }
    updateEloRole(id, dto, user) {
        return this.tasks.updateTaskEloRole(id, dto.eloRoleId ?? null, user);
    }
    updateSpecialty(id, dto, user) {
        return this.tasks.updateTaskSpecialty(id, dto.specialtyId ?? null, user);
    }
    batchAssign(body, user) {
        return this.tasks.batchAssign(body.ids ?? [], body.assignedToId ?? null, body.assigneeIds ?? [], user);
    }
    batchStatus(body, user) {
        return this.tasks.batchStatus(body.ids ?? [], body.status, user);
    }
    remove(id, user) {
        return this.tasks.deleteTaskInstance(id, user);
    }
    gantt(localityId, from, to, user) {
        return this.tasks.getGantt({ localityId, from, to }, user);
    }
    calendar(year, localityId, user) {
        return this.tasks.getCalendar(Number(year), localityId, user);
    }
    getById(id, user) {
        return this.tasks.getTaskInstanceById(id, user);
    }
};
exports.TaskInstancesController = TaskInstancesController;
__decorate([
    (0, common_1.Get)('assignees'),
    (0, require_permission_decorator_1.RequirePermission)('task_instances', 'assign'),
    __param(0, (0, common_1.Query)('localityId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], TaskInstancesController.prototype, "listAssignees", null);
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('task_instances', 'view'),
    __param(0, (0, common_1.Query)('localityId')),
    __param(1, (0, common_1.Query)('phaseId')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('assigneeId')),
    __param(4, (0, common_1.Query)('assigneeIds')),
    __param(5, (0, common_1.Query)('dueFrom')),
    __param(6, (0, common_1.Query)('dueTo')),
    __param(7, (0, common_1.Query)('meetingId')),
    __param(8, (0, common_1.Query)('eloRoleId')),
    __param(9, (0, common_1.Query)('specialtyId')),
    __param(10, (0, common_1.Query)('page')),
    __param(11, (0, common_1.Query)('pageSize')),
    __param(12, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], TaskInstancesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id/comments'),
    (0, require_permission_decorator_1.RequirePermission)('task_instances', 'view'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TaskInstancesController.prototype, "comments", null);
__decorate([
    (0, common_1.Post)(':id/comments'),
    (0, require_permission_decorator_1.RequirePermission)('task_instances', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, task_comment_dto_1.TaskCommentDto, Object]),
    __metadata("design:returntype", void 0)
], TaskInstancesController.prototype, "addComment", null);
__decorate([
    (0, common_1.Post)(':id/comments/seen'),
    (0, require_permission_decorator_1.RequirePermission)('task_instances', 'view'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TaskInstancesController.prototype, "markCommentsSeen", null);
__decorate([
    (0, common_1.Put)(':id/status'),
    (0, require_permission_decorator_1.RequirePermission)('task_instances', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, task_status_dto_1.TaskStatusDto, Object]),
    __metadata("design:returntype", void 0)
], TaskInstancesController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Put)(':id/progress'),
    (0, require_permission_decorator_1.RequirePermission)('task_instances', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, task_progress_dto_1.TaskProgressDto, Object]),
    __metadata("design:returntype", void 0)
], TaskInstancesController.prototype, "updateProgress", null);
__decorate([
    (0, common_1.Put)(':id/assign'),
    (0, require_permission_decorator_1.RequirePermission)('task_instances', 'assign'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, task_assign_dto_1.TaskAssignDto, Object]),
    __metadata("design:returntype", void 0)
], TaskInstancesController.prototype, "assign", null);
__decorate([
    (0, common_1.Put)(':id/meeting'),
    (0, require_permission_decorator_1.RequirePermission)('task_instances', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, task_meeting_dto_1.TaskMeetingDto, Object]),
    __metadata("design:returntype", void 0)
], TaskInstancesController.prototype, "updateMeeting", null);
__decorate([
    (0, common_1.Put)(':id/elo-role'),
    (0, require_permission_decorator_1.RequirePermission)('task_instances', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, task_elo_role_dto_1.TaskEloRoleDto, Object]),
    __metadata("design:returntype", void 0)
], TaskInstancesController.prototype, "updateEloRole", null);
__decorate([
    (0, common_1.Put)(':id/specialty'),
    (0, require_permission_decorator_1.RequirePermission)('task_instances', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, task_specialty_dto_1.TaskSpecialtyDto, Object]),
    __metadata("design:returntype", void 0)
], TaskInstancesController.prototype, "updateSpecialty", null);
__decorate([
    (0, common_1.Put)('batch/assign'),
    (0, require_permission_decorator_1.RequirePermission)('task_instances', 'assign'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], TaskInstancesController.prototype, "batchAssign", null);
__decorate([
    (0, common_1.Put)('batch/status'),
    (0, require_permission_decorator_1.RequirePermission)('task_instances', 'update'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], TaskInstancesController.prototype, "batchStatus", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('task_instances', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TaskInstancesController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)('gantt'),
    (0, require_permission_decorator_1.RequirePermission)('gantt', 'view'),
    __param(0, (0, common_1.Query)('localityId')),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], TaskInstancesController.prototype, "gantt", null);
__decorate([
    (0, common_1.Get)('calendar'),
    (0, require_permission_decorator_1.RequirePermission)('calendar', 'view'),
    __param(0, (0, common_1.Query)('year')),
    __param(1, (0, common_1.Query)('localityId')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], TaskInstancesController.prototype, "calendar", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('task_instances', 'view'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TaskInstancesController.prototype, "getById", null);
exports.TaskInstancesController = TaskInstancesController = __decorate([
    (0, common_1.Controller)('task-instances'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [tasks_service_1.TasksService])
], TaskInstancesController);
//# sourceMappingURL=task-instances.controller.js.map