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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivitiesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../common/current-user.decorator");
const http_error_1 = require("../common/http-error");
const require_permission_decorator_1 = require("../rbac/require-permission.decorator");
const rbac_guard_1 = require("../rbac/rbac.guard");
const activities_service_1 = require("./activities.service");
const create_activity_dto_1 = require("./dto/create-activity.dto");
const update_activity_dto_1 = require("./dto/update-activity.dto");
const update_activity_status_dto_1 = require("./dto/update-activity-status.dto");
const upsert_activity_report_dto_1 = require("./dto/upsert-activity-report.dto");
const activity_comment_dto_1 = require("./dto/activity-comment.dto");
const create_activity_schedule_item_dto_1 = require("./dto/create-activity-schedule-item.dto");
const update_activity_schedule_item_dto_1 = require("./dto/update-activity-schedule-item.dto");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const multer_exception_filter_1 = require("../reports/multer-exception.filter");
const throttler_1 = require("@nestjs/throttler");
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const uploadDir = node_path_1.default.resolve(process.cwd(), 'storage', 'activity-reports');
if (!node_fs_1.default.existsSync(uploadDir)) {
    node_fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
let ActivitiesController = class ActivitiesController {
    activities;
    constructor(activities) {
        this.activities = activities;
    }
    list(localityId, specialtyId, status, q, page, pageSize, user) {
        return this.activities.list({ localityId, specialtyId, status, q, page, pageSize }, user);
    }
    create(dto, user) {
        return this.activities.create(dto, user);
    }
    update(id, dto, user) {
        return this.activities.update(id, dto, user);
    }
    updateStatus(id, dto, user) {
        return this.activities.updateStatus(id, dto.status, user);
    }
    remove(id, user) {
        return this.activities.delete(id, user);
    }
    comments(id, user) {
        return this.activities.listComments(id, user);
    }
    addComment(id, dto, user) {
        return this.activities.addComment(id, dto.text, user);
    }
    markCommentsSeen(id, user) {
        return this.activities.markCommentsSeen(id, user);
    }
    listSchedule(id, user) {
        return this.activities.listSchedule(id, user);
    }
    createScheduleItem(id, dto, user) {
        return this.activities.createScheduleItem(id, dto, user);
    }
    updateScheduleItem(id, itemId, dto, user) {
        return this.activities.updateScheduleItem(id, itemId, dto, user);
    }
    deleteScheduleItem(id, itemId, user) {
        return this.activities.deleteScheduleItem(id, itemId, user);
    }
    async exportSchedulePdf(id, user, res) {
        const { fileName, buffer } = await this.activities.buildSchedulePdf(id, user);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(buffer);
    }
    upsertReport(id, dto, user) {
        return this.activities.upsertReport(id, dto, user);
    }
    signReport(id, user) {
        return this.activities.signReport(id, user);
    }
    async uploadPhoto(id, file, req, user) {
        if (!file) {
            if (req.fileValidationError === 'FILE_TYPE_INVALID') {
                (0, http_error_1.throwError)('FILE_TYPE_INVALID');
            }
            (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'FILE_REQUIRED' });
        }
        const fileUrl = `/activities/report-files/${file.filename}`;
        const filePath = node_path_1.default.join(uploadDir, file.filename);
        const buffer = node_fs_1.default.readFileSync(filePath);
        const checksum = node_crypto_1.default.createHash('sha256').update(buffer).digest('hex');
        return this.activities.addReportPhoto(id, {
            fileName: file.originalname,
            fileUrl,
            storageKey: file.filename,
            mimeType: file.mimetype,
            fileSize: file.size,
            checksum,
        }, user);
    }
    removePhoto(id, photoId, user) {
        return this.activities.removeReportPhoto(id, photoId, user);
    }
    async exportReportPdf(id, user, res) {
        const { fileName, buffer } = await this.activities.buildReportPdf(id, user);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(buffer);
    }
    downloadReportFile(filename, res) {
        const filePath = node_path_1.default.join(uploadDir, filename);
        if (!node_fs_1.default.existsSync(filePath)) {
            (0, http_error_1.throwError)('NOT_FOUND');
        }
        return res.sendFile(filePath);
    }
};
exports.ActivitiesController = ActivitiesController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('task_instances', 'view'),
    __param(0, (0, common_1.Query)('localityId')),
    __param(1, (0, common_1.Query)('specialtyId')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('q')),
    __param(4, (0, common_1.Query)('page')),
    __param(5, (0, common_1.Query)('pageSize')),
    __param(6, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], ActivitiesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)('task_instances', 'create'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_activity_dto_1.CreateActivityDto, Object]),
    __metadata("design:returntype", void 0)
], ActivitiesController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('task_instances', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_activity_dto_1.UpdateActivityDto, Object]),
    __metadata("design:returntype", void 0)
], ActivitiesController.prototype, "update", null);
__decorate([
    (0, common_1.Put)(':id/status'),
    (0, require_permission_decorator_1.RequirePermission)('task_instances', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_activity_status_dto_1.UpdateActivityStatusDto, Object]),
    __metadata("design:returntype", void 0)
], ActivitiesController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('task_instances', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ActivitiesController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':id/comments'),
    (0, require_permission_decorator_1.RequirePermission)('task_instances', 'view'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ActivitiesController.prototype, "comments", null);
__decorate([
    (0, common_1.Post)(':id/comments'),
    (0, require_permission_decorator_1.RequirePermission)('task_instances', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, activity_comment_dto_1.ActivityCommentDto, Object]),
    __metadata("design:returntype", void 0)
], ActivitiesController.prototype, "addComment", null);
__decorate([
    (0, common_1.Post)(':id/comments/seen'),
    (0, require_permission_decorator_1.RequirePermission)('task_instances', 'view'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ActivitiesController.prototype, "markCommentsSeen", null);
__decorate([
    (0, common_1.Get)(':id/schedule'),
    (0, require_permission_decorator_1.RequirePermission)('task_instances', 'view'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ActivitiesController.prototype, "listSchedule", null);
__decorate([
    (0, common_1.Post)(':id/schedule'),
    (0, require_permission_decorator_1.RequirePermission)('task_instances', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_activity_schedule_item_dto_1.CreateActivityScheduleItemDto, Object]),
    __metadata("design:returntype", void 0)
], ActivitiesController.prototype, "createScheduleItem", null);
__decorate([
    (0, common_1.Put)(':id/schedule/:itemId'),
    (0, require_permission_decorator_1.RequirePermission)('task_instances', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('itemId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_activity_schedule_item_dto_1.UpdateActivityScheduleItemDto, Object]),
    __metadata("design:returntype", void 0)
], ActivitiesController.prototype, "updateScheduleItem", null);
__decorate([
    (0, common_1.Delete)(':id/schedule/:itemId'),
    (0, require_permission_decorator_1.RequirePermission)('task_instances', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('itemId')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], ActivitiesController.prototype, "deleteScheduleItem", null);
__decorate([
    (0, common_1.Get)(':id/schedule/pdf'),
    (0, require_permission_decorator_1.RequirePermission)('reports', 'download'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "exportSchedulePdf", null);
__decorate([
    (0, common_1.Put)(':id/report'),
    (0, require_permission_decorator_1.RequirePermission)('reports', 'create'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, upsert_activity_report_dto_1.UpsertActivityReportDto, Object]),
    __metadata("design:returntype", void 0)
], ActivitiesController.prototype, "upsertReport", null);
__decorate([
    (0, common_1.Post)(':id/report/sign'),
    (0, require_permission_decorator_1.RequirePermission)('reports', 'approve'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ActivitiesController.prototype, "signReport", null);
__decorate([
    (0, common_1.Post)(':id/report/photos'),
    (0, require_permission_decorator_1.RequirePermission)('reports', 'upload'),
    (0, common_1.UseGuards)(throttler_1.ThrottlerGuard),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60_000 } }),
    (0, common_1.UseFilters)(multer_exception_filter_1.MulterExceptionFilter),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: uploadDir,
            filename: (_req, file, cb) => {
                const unique = `${Date.now()}-${file.originalname}`;
                cb(null, unique);
            },
        }),
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
            const allowed = ['image/png', 'image/jpeg'];
            if (!allowed.includes(file.mimetype)) {
                req.fileValidationError = 'FILE_TYPE_INVALID';
                return cb(null, false);
            }
            cb(null, true);
        },
    })),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "uploadPhoto", null);
__decorate([
    (0, common_1.Delete)(':id/report/photos/:photoId'),
    (0, require_permission_decorator_1.RequirePermission)('reports', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('photoId')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], ActivitiesController.prototype, "removePhoto", null);
__decorate([
    (0, common_1.Get)(':id/report/pdf'),
    (0, require_permission_decorator_1.RequirePermission)('reports', 'download'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ActivitiesController.prototype, "exportReportPdf", null);
__decorate([
    (0, common_1.Get)('report-files/:filename'),
    (0, require_permission_decorator_1.RequirePermission)('reports', 'download'),
    __param(0, (0, common_1.Param)('filename')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ActivitiesController.prototype, "downloadReportFile", null);
exports.ActivitiesController = ActivitiesController = __decorate([
    (0, common_1.Controller)('activities'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [activities_service_1.ActivitiesService])
], ActivitiesController);
//# sourceMappingURL=activities.controller.js.map