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
exports.BiRecruitsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const throttler_1 = require("@nestjs/throttler");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../common/current-user.decorator");
const http_error_1 = require("../common/http-error");
const multer_exception_filter_1 = require("../reports/multer-exception.filter");
const require_permission_decorator_1 = require("../rbac/require-permission.decorator");
const rbac_guard_1 = require("../rbac/rbac.guard");
const role_access_1 = require("../rbac/role-access");
const bi_recruits_service_1 = require("./bi-recruits.service");
let BiRecruitsController = class BiRecruitsController {
    biRecruits;
    constructor(biRecruits) {
        this.biRecruits = biRecruits;
    }
    assertRecruitsAccess(user) {
        if (!(0, role_access_1.hasAnyRole)(user, [role_access_1.ROLE_TI, role_access_1.ROLE_COMGEP])) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
    assertTiForSettings(user) {
        if (!(0, role_access_1.hasAnyRole)(user, [role_access_1.ROLE_TI])) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
    dashboard(from, to, education, gender, identifyHarassment, conductLimits, knowOrientation, knowReportProcess, willingnessOrientation, willingnessReport, enlistmentDecisionInfluence, q, combineMode, user) {
        this.assertRecruitsAccess(user);
        return this.biRecruits.dashboard({
            from,
            to,
            education,
            gender,
            identifyHarassment,
            conductLimits,
            knowOrientation,
            knowReportProcess,
            willingnessOrientation,
            willingnessReport,
            enlistmentDecisionInfluence,
            q,
            combineMode,
        });
    }
    listResponses(from, to, education, gender, identifyHarassment, conductLimits, knowOrientation, knowReportProcess, willingnessOrientation, willingnessReport, enlistmentDecisionInfluence, q, combineMode, page, pageSize, user) {
        this.assertRecruitsAccess(user);
        return this.biRecruits.listResponses({
            from,
            to,
            education,
            gender,
            identifyHarassment,
            conductLimits,
            knowOrientation,
            knowReportProcess,
            willingnessOrientation,
            willingnessReport,
            enlistmentDecisionInfluence,
            q,
            combineMode,
            page,
            pageSize,
        });
    }
    listImports(page, pageSize, user) {
        this.assertRecruitsAccess(user);
        return this.biRecruits.listImports({ page, pageSize });
    }
    importResponses(file, replace, req, user) {
        this.assertRecruitsAccess(user);
        if (!file) {
            if (req.fileValidationError === 'BI_FILE_TYPE_INVALID') {
                (0, http_error_1.throwError)('BI_FILE_TYPE_INVALID');
            }
            (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'FILE_REQUIRED' });
        }
        const replaceAll = typeof replace === 'string'
            ? ['1', 'true', 'sim', 'yes'].includes(replace.toLowerCase().trim())
            : false;
        return this.biRecruits.importResponses(file, user, {
            replaceAll,
        });
    }
    deleteResponses(body, user) {
        this.assertRecruitsAccess(user);
        return this.biRecruits.deleteResponses(body);
    }
    listCardSettings(user) {
        this.assertRecruitsAccess(user);
        return this.biRecruits.listCardSettings();
    }
    updateCardSetting(cardId, body, user) {
        this.assertRecruitsAccess(user);
        this.assertTiForSettings(user);
        return this.biRecruits.updateCardSetting(cardId, body, user);
    }
};
exports.BiRecruitsController = BiRecruitsController;
__decorate([
    (0, common_1.Get)('dashboard'),
    (0, require_permission_decorator_1.RequirePermission)('bi', 'view'),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __param(2, (0, common_1.Query)('education')),
    __param(3, (0, common_1.Query)('gender')),
    __param(4, (0, common_1.Query)('identifyHarassment')),
    __param(5, (0, common_1.Query)('conductLimits')),
    __param(6, (0, common_1.Query)('knowOrientation')),
    __param(7, (0, common_1.Query)('knowReportProcess')),
    __param(8, (0, common_1.Query)('willingnessOrientation')),
    __param(9, (0, common_1.Query)('willingnessReport')),
    __param(10, (0, common_1.Query)('enlistmentDecisionInfluence')),
    __param(11, (0, common_1.Query)('q')),
    __param(12, (0, common_1.Query)('combineMode')),
    __param(13, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], BiRecruitsController.prototype, "dashboard", null);
__decorate([
    (0, common_1.Get)('responses'),
    (0, require_permission_decorator_1.RequirePermission)('bi', 'view'),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __param(2, (0, common_1.Query)('education')),
    __param(3, (0, common_1.Query)('gender')),
    __param(4, (0, common_1.Query)('identifyHarassment')),
    __param(5, (0, common_1.Query)('conductLimits')),
    __param(6, (0, common_1.Query)('knowOrientation')),
    __param(7, (0, common_1.Query)('knowReportProcess')),
    __param(8, (0, common_1.Query)('willingnessOrientation')),
    __param(9, (0, common_1.Query)('willingnessReport')),
    __param(10, (0, common_1.Query)('enlistmentDecisionInfluence')),
    __param(11, (0, common_1.Query)('q')),
    __param(12, (0, common_1.Query)('combineMode')),
    __param(13, (0, common_1.Query)('page')),
    __param(14, (0, common_1.Query)('pageSize')),
    __param(15, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], BiRecruitsController.prototype, "listResponses", null);
__decorate([
    (0, common_1.Get)('imports'),
    (0, require_permission_decorator_1.RequirePermission)('bi', 'view'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('pageSize')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", void 0)
], BiRecruitsController.prototype, "listImports", null);
__decorate([
    (0, common_1.Post)('import'),
    (0, require_permission_decorator_1.RequirePermission)('bi', 'upload'),
    (0, common_1.UseGuards)(throttler_1.ThrottlerGuard),
    (0, throttler_1.Throttle)({ default: { limit: 20, ttl: 60_000 } }),
    (0, common_1.UseFilters)(multer_exception_filter_1.MulterExceptionFilter),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
            const lowerName = file.originalname.toLowerCase();
            const accepted = lowerName.endsWith('.csv') ||
                lowerName.endsWith('.xlsx') ||
                lowerName.endsWith('.xls');
            if (!accepted) {
                req.fileValidationError = 'BI_FILE_TYPE_INVALID';
                return cb(null, false);
            }
            cb(null, true);
        },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)('replace')),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], BiRecruitsController.prototype, "importResponses", null);
__decorate([
    (0, common_1.Post)('responses/delete'),
    (0, require_permission_decorator_1.RequirePermission)('bi', 'delete'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], BiRecruitsController.prototype, "deleteResponses", null);
__decorate([
    (0, common_1.Get)('card-settings'),
    (0, require_permission_decorator_1.RequirePermission)('bi', 'view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BiRecruitsController.prototype, "listCardSettings", null);
__decorate([
    (0, common_1.Put)('card-settings/:cardId'),
    (0, require_permission_decorator_1.RequirePermission)('bi', 'upload'),
    __param(0, (0, common_1.Param)('cardId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], BiRecruitsController.prototype, "updateCardSetting", null);
exports.BiRecruitsController = BiRecruitsController = __decorate([
    (0, common_1.Controller)('bi/recruits'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [bi_recruits_service_1.BiRecruitsService])
], BiRecruitsController);
//# sourceMappingURL=bi-recruits.controller.js.map