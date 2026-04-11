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
exports.BiDomesticViolenceController = void 0;
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
const bi_domestic_violence_service_1 = require("./bi-domestic-violence.service");
let BiDomesticViolenceController = class BiDomesticViolenceController {
    biDomesticViolence;
    constructor(biDomesticViolence) {
        this.biDomesticViolence = biDomesticViolence;
    }
    assertTiForSettings(user) {
        if (!(0, role_access_1.hasAnyRole)(user, [role_access_1.ROLE_TI])) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
    dashboard(from, to, organization, rank, maritalStatus, education, naturality, fabBond, situationScope, sufferedLifetime, sufferedLast12Months, frequency, affectiveBond, violenceType, authorRelation, impactIntensity, impactArea, soughtHelp, complaintChannel, noComplaintReason, authorMilitaryLink, occurrencePlace, witnesses, q, combineMode, user) {
        return this.biDomesticViolence.dashboard({
            from,
            to,
            organization,
            rank,
            maritalStatus,
            education,
            naturality,
            fabBond,
            situationScope,
            sufferedLifetime,
            sufferedLast12Months,
            frequency,
            affectiveBond,
            violenceType,
            authorRelation,
            impactIntensity,
            impactArea,
            soughtHelp,
            complaintChannel,
            noComplaintReason,
            authorMilitaryLink,
            occurrencePlace,
            witnesses,
            q,
            combineMode,
        });
    }
    listResponses(from, to, organization, rank, maritalStatus, education, naturality, fabBond, situationScope, sufferedLifetime, sufferedLast12Months, frequency, affectiveBond, violenceType, authorRelation, impactIntensity, impactArea, soughtHelp, complaintChannel, noComplaintReason, authorMilitaryLink, occurrencePlace, witnesses, q, combineMode, page, pageSize, user) {
        return this.biDomesticViolence.listResponses({
            from,
            to,
            organization,
            rank,
            maritalStatus,
            education,
            naturality,
            fabBond,
            situationScope,
            sufferedLifetime,
            sufferedLast12Months,
            frequency,
            affectiveBond,
            violenceType,
            authorRelation,
            impactIntensity,
            impactArea,
            soughtHelp,
            complaintChannel,
            noComplaintReason,
            authorMilitaryLink,
            occurrencePlace,
            witnesses,
            q,
            combineMode,
            page,
            pageSize,
        });
    }
    listImports(page, pageSize, user) {
        return this.biDomesticViolence.listImports({ page, pageSize });
    }
    importResponses(file, replace, req, user) {
        if (!file) {
            if (req.fileValidationError === 'BI_FILE_TYPE_INVALID') {
                (0, http_error_1.throwError)('BI_FILE_TYPE_INVALID');
            }
            (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'FILE_REQUIRED' });
        }
        const replaceAll = typeof replace === 'string'
            ? ['1', 'true', 'sim', 'yes'].includes(replace.toLowerCase().trim())
            : false;
        return this.biDomesticViolence.importResponses(file, user, {
            replaceAll,
        });
    }
    deleteResponses(body, user) {
        return this.biDomesticViolence.deleteResponses(body);
    }
    listCardSettings(user) {
        return this.biDomesticViolence.listCardSettings();
    }
    updateCardSetting(cardId, body, user) {
        this.assertTiForSettings(user);
        return this.biDomesticViolence.updateCardSetting(cardId, body, user);
    }
};
exports.BiDomesticViolenceController = BiDomesticViolenceController;
__decorate([
    (0, common_1.Get)('dashboard'),
    (0, require_permission_decorator_1.RequirePermission)('bi', 'view'),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __param(2, (0, common_1.Query)('organization')),
    __param(3, (0, common_1.Query)('rank')),
    __param(4, (0, common_1.Query)('maritalStatus')),
    __param(5, (0, common_1.Query)('education')),
    __param(6, (0, common_1.Query)('naturality')),
    __param(7, (0, common_1.Query)('fabBond')),
    __param(8, (0, common_1.Query)('situationScope')),
    __param(9, (0, common_1.Query)('sufferedLifetime')),
    __param(10, (0, common_1.Query)('sufferedLast12Months')),
    __param(11, (0, common_1.Query)('frequency')),
    __param(12, (0, common_1.Query)('affectiveBond')),
    __param(13, (0, common_1.Query)('violenceType')),
    __param(14, (0, common_1.Query)('authorRelation')),
    __param(15, (0, common_1.Query)('impactIntensity')),
    __param(16, (0, common_1.Query)('impactArea')),
    __param(17, (0, common_1.Query)('soughtHelp')),
    __param(18, (0, common_1.Query)('complaintChannel')),
    __param(19, (0, common_1.Query)('noComplaintReason')),
    __param(20, (0, common_1.Query)('authorMilitaryLink')),
    __param(21, (0, common_1.Query)('occurrencePlace')),
    __param(22, (0, common_1.Query)('witnesses')),
    __param(23, (0, common_1.Query)('q')),
    __param(24, (0, common_1.Query)('combineMode')),
    __param(25, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], BiDomesticViolenceController.prototype, "dashboard", null);
__decorate([
    (0, common_1.Get)('responses'),
    (0, require_permission_decorator_1.RequirePermission)('bi', 'view'),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __param(2, (0, common_1.Query)('organization')),
    __param(3, (0, common_1.Query)('rank')),
    __param(4, (0, common_1.Query)('maritalStatus')),
    __param(5, (0, common_1.Query)('education')),
    __param(6, (0, common_1.Query)('naturality')),
    __param(7, (0, common_1.Query)('fabBond')),
    __param(8, (0, common_1.Query)('situationScope')),
    __param(9, (0, common_1.Query)('sufferedLifetime')),
    __param(10, (0, common_1.Query)('sufferedLast12Months')),
    __param(11, (0, common_1.Query)('frequency')),
    __param(12, (0, common_1.Query)('affectiveBond')),
    __param(13, (0, common_1.Query)('violenceType')),
    __param(14, (0, common_1.Query)('authorRelation')),
    __param(15, (0, common_1.Query)('impactIntensity')),
    __param(16, (0, common_1.Query)('impactArea')),
    __param(17, (0, common_1.Query)('soughtHelp')),
    __param(18, (0, common_1.Query)('complaintChannel')),
    __param(19, (0, common_1.Query)('noComplaintReason')),
    __param(20, (0, common_1.Query)('authorMilitaryLink')),
    __param(21, (0, common_1.Query)('occurrencePlace')),
    __param(22, (0, common_1.Query)('witnesses')),
    __param(23, (0, common_1.Query)('q')),
    __param(24, (0, common_1.Query)('combineMode')),
    __param(25, (0, common_1.Query)('page')),
    __param(26, (0, common_1.Query)('pageSize')),
    __param(27, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], BiDomesticViolenceController.prototype, "listResponses", null);
__decorate([
    (0, common_1.Get)('imports'),
    (0, require_permission_decorator_1.RequirePermission)('bi', 'view'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('pageSize')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", void 0)
], BiDomesticViolenceController.prototype, "listImports", null);
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
], BiDomesticViolenceController.prototype, "importResponses", null);
__decorate([
    (0, common_1.Post)('responses/delete'),
    (0, require_permission_decorator_1.RequirePermission)('bi', 'delete'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], BiDomesticViolenceController.prototype, "deleteResponses", null);
__decorate([
    (0, common_1.Get)('card-settings'),
    (0, require_permission_decorator_1.RequirePermission)('bi', 'view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BiDomesticViolenceController.prototype, "listCardSettings", null);
__decorate([
    (0, common_1.Put)('card-settings/:cardId'),
    (0, require_permission_decorator_1.RequirePermission)('bi', 'upload'),
    __param(0, (0, common_1.Param)('cardId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], BiDomesticViolenceController.prototype, "updateCardSetting", null);
exports.BiDomesticViolenceController = BiDomesticViolenceController = __decorate([
    (0, common_1.Controller)('bi/domestic-violence'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [bi_domestic_violence_service_1.BiDomesticViolenceService])
], BiDomesticViolenceController);
//# sourceMappingURL=bi-domestic-violence.controller.js.map