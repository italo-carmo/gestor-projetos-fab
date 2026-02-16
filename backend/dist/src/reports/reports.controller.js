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
exports.ReportsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../common/current-user.decorator");
const http_error_1 = require("../common/http-error");
const require_permission_decorator_1 = require("../rbac/require-permission.decorator");
const rbac_guard_1 = require("../rbac/rbac.guard");
const reports_service_1 = require("./reports.service");
const throttler_1 = require("@nestjs/throttler");
const multer_exception_filter_1 = require("./multer-exception.filter");
const uploadDir = node_path_1.default.resolve(process.cwd(), 'storage', 'reports');
if (!node_fs_1.default.existsSync(uploadDir)) {
    node_fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
let ReportsController = class ReportsController {
    reports;
    constructor(reports) {
        this.reports = reports;
    }
    async upload(file, taskInstanceId, req, user) {
        if (!file) {
            if (req.fileValidationError === 'FILE_TYPE_INVALID') {
                (0, http_error_1.throwError)('FILE_TYPE_INVALID');
            }
            (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'FILE_REQUIRED' });
        }
        const fileUrl = `/reports/files/${file.filename}`;
        const filePath = node_path_1.default.join(uploadDir, file.filename);
        const buffer = node_fs_1.default.readFileSync(filePath);
        const checksum = node_crypto_1.default.createHash('sha256').update(buffer).digest('hex');
        return this.reports.createReport({
            taskInstanceId,
            fileName: file.originalname,
            fileUrl,
            storageKey: file.filename,
            mimeType: file.mimetype,
            fileSize: file.size,
            checksum,
        }, user);
    }
    async download(id, token, res, user) {
        if (!token) {
            return res.status(401).send({ message: 'Token ausente', code: 'AUTH_INVALID_CREDENTIALS' });
        }
        const reportId = await this.reports.verifyDownloadToken(token);
        if (reportId !== id) {
            return res.status(401).send({ message: 'Token invalido', code: 'AUTH_INVALID_CREDENTIALS' });
        }
        const report = await this.reports.getReport(id, user);
        const fileName = report.storageKey ?? node_path_1.default.basename(report.fileUrl);
        const filePath = node_path_1.default.join(uploadDir, fileName);
        return res.download(filePath, report.fileName);
    }
    signedUrl(id, user) {
        return this.reports.getSignedUrl(id, user);
    }
    approve(id, approved, user) {
        return this.reports.approveReport(id, approved, user);
    }
};
exports.ReportsController = ReportsController;
__decorate([
    (0, common_1.Post)('upload'),
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
            const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
            if (!allowed.includes(file.mimetype)) {
                req.fileValidationError = 'FILE_TYPE_INVALID';
                return cb(null, false);
            }
            cb(null, true);
        },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)('taskInstanceId')),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "upload", null);
__decorate([
    (0, common_1.Get)(':id/download'),
    (0, require_permission_decorator_1.RequirePermission)('reports', 'download'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('token')),
    __param(2, (0, common_1.Res)()),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "download", null);
__decorate([
    (0, common_1.Get)(':id/signed-url'),
    (0, require_permission_decorator_1.RequirePermission)('reports', 'download'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "signedUrl", null);
__decorate([
    (0, common_1.Put)(':id/approve'),
    (0, require_permission_decorator_1.RequirePermission)('reports', 'approve'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('approved')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Boolean, Object]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "approve", null);
exports.ReportsController = ReportsController = __decorate([
    (0, common_1.Controller)('reports'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [reports_service_1.ReportsService])
], ReportsController);
//# sourceMappingURL=reports.controller.js.map