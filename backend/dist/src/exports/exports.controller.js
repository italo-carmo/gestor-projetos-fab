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
exports.ExportsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const require_permission_decorator_1 = require("../rbac/require-permission.decorator");
const rbac_guard_1 = require("../rbac/rbac.guard");
const current_user_decorator_1 = require("../common/current-user.decorator");
const tasks_service_1 = require("../tasks/tasks.service");
const checklists_service_1 = require("../checklists/checklists.service");
let ExportsController = class ExportsController {
    tasks;
    checklists;
    constructor(tasks, checklists) {
        this.tasks = tasks;
        this.checklists = checklists;
    }
    async exportTasks(localityId, phaseId, status, assigneeId, assigneeIds, dueFrom, dueTo, user, res) {
        const items = await this.tasks.listTaskInstancesForExport({ localityId, phaseId, status, assigneeId, assigneeIds, dueFrom, dueTo }, user);
        const headers = [
            'taskId',
            'title',
            'phase',
            'locality',
            'status',
            'priority',
            'dueDate',
            'assigneeTipo',
            'assigneeId',
            'assigneeNome',
            'progressPercent',
            'isLate',
            'meetingId',
        ];
        const rows = items.map((item) => [
            item.id,
            item.taskTemplate?.title ?? '',
            item.taskTemplate?.phase?.name ?? '',
            item.locality?.name ?? item.localityId ?? '',
            item.status,
            item.priority,
            item.dueDate ? new Date(item.dueDate).toISOString() : '',
            item.assignee?.type ?? item.assigneeType ?? '',
            item.assignedToId ?? item.assignedEloId ?? '',
            item.assignee?.name ?? item.externalAssigneeName ?? '',
            String(item.progressPercent ?? 0),
            item.isLate ? 'true' : 'false',
            item.meetingId ?? '',
        ]);
        const csv = toCsv(headers, rows);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="tasks.csv"');
        res.send(csv);
    }
    async exportChecklists(phaseId, specialtyId, user, res) {
        const data = await this.checklists.list({ phaseId, specialtyId }, user);
        const localities = data.localities ?? [];
        const headers = ['checklist', 'item', ...localities.map((l) => l.name)];
        const rows = [];
        for (const checklist of data.items ?? []) {
            for (const item of checklist.items ?? []) {
                rows.push([
                    checklist.title,
                    item.title,
                    ...localities.map((loc) => item.statuses?.[loc.id] ?? ''),
                ]);
            }
        }
        const csv = toCsv(headers, rows);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="checklists.csv"');
        res.send(csv);
    }
};
exports.ExportsController = ExportsController;
__decorate([
    (0, common_1.Get)('tasks.csv'),
    (0, require_permission_decorator_1.RequirePermission)('task_instances', 'export'),
    __param(0, (0, common_1.Query)('localityId')),
    __param(1, (0, common_1.Query)('phaseId')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('assigneeId')),
    __param(4, (0, common_1.Query)('assigneeIds')),
    __param(5, (0, common_1.Query)('dueFrom')),
    __param(6, (0, common_1.Query)('dueTo')),
    __param(7, (0, current_user_decorator_1.CurrentUser)()),
    __param(8, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object, Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ExportsController.prototype, "exportTasks", null);
__decorate([
    (0, common_1.Get)('checklists.csv'),
    (0, require_permission_decorator_1.RequirePermission)('checklists', 'export'),
    __param(0, (0, common_1.Query)('phaseId')),
    __param(1, (0, common_1.Query)('specialtyId')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ExportsController.prototype, "exportChecklists", null);
exports.ExportsController = ExportsController = __decorate([
    (0, common_1.Controller)('exports'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [tasks_service_1.TasksService,
        checklists_service_1.ChecklistsService])
], ExportsController);
function toCsv(headers, rows) {
    const escape = (value) => {
        const sanitized = value ?? '';
        if (sanitized.includes('"') || sanitized.includes(',') || sanitized.includes('\n')) {
            return `"${sanitized.replace(/"/g, '""')}"`;
        }
        return sanitized;
    };
    const lines = [headers.map(escape).join(',')];
    for (const row of rows) {
        lines.push(row.map((cell) => escape(String(cell ?? ''))).join(','));
    }
    return lines.join('\n');
}
//# sourceMappingURL=exports.controller.js.map