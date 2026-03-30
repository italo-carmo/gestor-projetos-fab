"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissionsChecklistUploadsController = exports.MissionsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const node_crypto_1 = require("node:crypto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../common/current-user.decorator");
const rbac_guard_1 = require("../rbac/rbac.guard");
const missions_service_1 = require("./missions.service");
const create_mission_dto_1 = require("./dto/create-mission.dto");
const update_mission_dto_1 = require("./dto/update-mission.dto");
const create_mission_schedule_item_dto_1 = require("./dto/create-mission-schedule-item.dto");
const update_mission_schedule_item_dto_1 = require("./dto/update-mission-schedule-item.dto");
const mission_ldap_participant_dto_1 = require("./dto/mission-ldap-participant.dto");
const mission_user_participant_dto_1 = require("./dto/mission-user-participant.dto");
const upsert_mission_checklist_dto_1 = require("./dto/upsert-mission-checklist.dto");
const create_mission_checklist_dimension_dto_1 = require("./dto/create-mission-checklist-dimension.dto");
const update_mission_checklist_dimension_dto_1 = require("./dto/update-mission-checklist-dimension.dto");
const update_mission_checklist_classification_dto_1 = require("./dto/update-mission-checklist-classification.dto");
const multer_exception_filter_1 = require("../reports/multer-exception.filter");
const http_error_1 = require("../common/http-error");
const mission_checklist_storage_1 = require("./mission-checklist-storage");
const checklistPhotosDir = (0, mission_checklist_storage_1.getMissionChecklistPhotosDir)();
if (!fs.existsSync(checklistPhotosDir)) {
    fs.mkdirSync(checklistPhotosDir, { recursive: true });
}
let MissionsController = class MissionsController {
    missions;
    constructor(missions) {
        this.missions = missions;
    }
    list(localityId, q, page, pageSize, user) {
        return this.missions.list({ localityId, q, page, pageSize }, user);
    }
    getStatistics(user) {
        return this.missions.getStatistics(user);
    }
    getChecklistMapping(localityId, user) {
        return this.missions.getChecklistMapping({ localityId }, user);
    }
    getChecklistConfig(user) {
        return this.missions.getChecklistConfig(user);
    }
    createChecklistDimension(dto, user) {
        return this.missions.createChecklistDimension(dto, user);
    }
    updateChecklistDimension(id, dto, user) {
        return this.missions.updateChecklistDimension(id, dto, user);
    }
    deleteChecklistDimension(id, user) {
        return this.missions.deleteChecklistDimension(id, user);
    }
    updateChecklistClassification(id, dto, user) {
        return this.missions.updateChecklistClassification(id, dto, user);
    }
    create(dto, user) {
        return this.missions.create(dto, user);
    }
    update(id, dto, user) {
        return this.missions.update(id, dto, user);
    }
    remove(id, user) {
        return this.missions.delete(id, user);
    }
    lookupLdapParticipant(q, user) {
        return this.missions.lookupLdapParticipant(q, user);
    }
    getById(id, user) {
        return this.missions.getById(id, user);
    }
    getChecklist(id, user) {
        return this.missions.getChecklist(id, user);
    }
    upsertChecklist(id, dto, user) {
        return this.missions.upsertChecklist(id, dto, user);
    }
    async uploadChecklistPhoto(id, file, user) {
        if (!file) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field: 'file', reason: 'required' });
        }
        await this.missions.assertChecklistUploadAccess(id, user);
        return { photoUrl: `/missions/checklist/uploads/${file.filename}` };
    }
    addParticipantFromLdap(id, dto, user) {
        return this.missions.addParticipantFromLdap(id, dto.identifier, user);
    }
    addParticipantFromUser(id, dto, user) {
        return this.missions.addParticipantFromUser(id, dto.userId, user);
    }
    removeParticipant(id, participantId, user) {
        return this.missions.removeParticipant(id, participantId, user);
    }
    listSchedule(id, user) {
        return this.missions.listSchedule(id, user);
    }
    createScheduleItem(id, dto, user) {
        return this.missions.createScheduleItem(id, dto, user);
    }
    updateScheduleItem(id, itemId, dto, user) {
        return this.missions.updateScheduleItem(id, itemId, dto, user);
    }
    deleteScheduleItem(id, itemId, user) {
        return this.missions.deleteScheduleItem(id, itemId, user);
    }
    async exportSchedulePdf(id, user, res) {
        const { fileName, buffer } = await this.missions.buildSchedulePdf(id, user);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(buffer);
    }
};
exports.MissionsController = MissionsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('localityId')),
    __param(1, (0, common_1.Query)('q')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('pageSize')),
    __param(4, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], MissionsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('statistics'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MissionsController.prototype, "getStatistics", null);
__decorate([
    (0, common_1.Get)('checklist/mapping'),
    __param(0, (0, common_1.Query)('localityId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], MissionsController.prototype, "getChecklistMapping", null);
__decorate([
    (0, common_1.Get)('checklist/config'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MissionsController.prototype, "getChecklistConfig", null);
__decorate([
    (0, common_1.Post)('checklist/config/dimensions'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_mission_checklist_dimension_dto_1.CreateMissionChecklistDimensionDto, Object]),
    __metadata("design:returntype", void 0)
], MissionsController.prototype, "createChecklistDimension", null);
__decorate([
    (0, common_1.Put)('checklist/config/dimensions/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_mission_checklist_dimension_dto_1.UpdateMissionChecklistDimensionDto, Object]),
    __metadata("design:returntype", void 0)
], MissionsController.prototype, "updateChecklistDimension", null);
__decorate([
    (0, common_1.Delete)('checklist/config/dimensions/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MissionsController.prototype, "deleteChecklistDimension", null);
__decorate([
    (0, common_1.Put)('checklist/config/classifications/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_mission_checklist_classification_dto_1.UpdateMissionChecklistClassificationDto, Object]),
    __metadata("design:returntype", void 0)
], MissionsController.prototype, "updateChecklistClassification", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_mission_dto_1.CreateMissionDto, Object]),
    __metadata("design:returntype", void 0)
], MissionsController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_mission_dto_1.UpdateMissionDto, Object]),
    __metadata("design:returntype", void 0)
], MissionsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MissionsController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)('ldap-participant'),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], MissionsController.prototype, "lookupLdapParticipant", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MissionsController.prototype, "getById", null);
__decorate([
    (0, common_1.Get)(':id/checklist'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MissionsController.prototype, "getChecklist", null);
__decorate([
    (0, common_1.Put)(':id/checklist'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, upsert_mission_checklist_dto_1.UpsertMissionChecklistDto, Object]),
    __metadata("design:returntype", void 0)
], MissionsController.prototype, "upsertChecklist", null);
__decorate([
    (0, common_1.Post)(':id/checklist/photos'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: checklistPhotosDir,
            filename: (_req, file, cb) => {
                const extension = path.extname(file.originalname || '').toLowerCase();
                const safeExtension = extension && extension.length <= 10 ? extension : '.jpg';
                cb(null, `${Date.now()}-${(0, node_crypto_1.randomUUID)()}${safeExtension}`);
            },
        }),
        fileFilter: (_req, file, cb) => {
            const mimetype = String(file.mimetype ?? '').toLowerCase();
            cb(null, mimetype.startsWith('image/'));
        },
        limits: { fileSize: 8 * 1024 * 1024 },
    })),
    (0, common_1.UseFilters)(multer_exception_filter_1.MulterExceptionFilter),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], MissionsController.prototype, "uploadChecklistPhoto", null);
__decorate([
    (0, common_1.Post)(':id/participants/ldap'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, mission_ldap_participant_dto_1.MissionLdapParticipantDto, Object]),
    __metadata("design:returntype", void 0)
], MissionsController.prototype, "addParticipantFromLdap", null);
__decorate([
    (0, common_1.Post)(':id/participants/user'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, mission_user_participant_dto_1.MissionUserParticipantDto, Object]),
    __metadata("design:returntype", void 0)
], MissionsController.prototype, "addParticipantFromUser", null);
__decorate([
    (0, common_1.Delete)(':id/participants/:participantId'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('participantId')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], MissionsController.prototype, "removeParticipant", null);
__decorate([
    (0, common_1.Get)(':id/schedule'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MissionsController.prototype, "listSchedule", null);
__decorate([
    (0, common_1.Post)(':id/schedule'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_mission_schedule_item_dto_1.CreateMissionScheduleItemDto, Object]),
    __metadata("design:returntype", void 0)
], MissionsController.prototype, "createScheduleItem", null);
__decorate([
    (0, common_1.Put)(':id/schedule/:itemId'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('itemId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_mission_schedule_item_dto_1.UpdateMissionScheduleItemDto, Object]),
    __metadata("design:returntype", void 0)
], MissionsController.prototype, "updateScheduleItem", null);
__decorate([
    (0, common_1.Delete)(':id/schedule/:itemId'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('itemId')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], MissionsController.prototype, "deleteScheduleItem", null);
__decorate([
    (0, common_1.Get)(':id/schedule/pdf'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], MissionsController.prototype, "exportSchedulePdf", null);
exports.MissionsController = MissionsController = __decorate([
    (0, common_1.Controller)('missions'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [missions_service_1.MissionsService])
], MissionsController);
let MissionsChecklistUploadsController = class MissionsChecklistUploadsController {
    async uploadedPhoto(filename, res) {
        const safeName = path.basename(String(filename ?? ''));
        if (!safeName || safeName !== filename)
            (0, http_error_1.throwError)('NOT_FOUND');
        const filePath = (0, mission_checklist_storage_1.getMissionChecklistPhotoCandidates)(safeName).find((candidate) => fs.existsSync(candidate));
        if (!filePath)
            (0, http_error_1.throwError)('NOT_FOUND');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.sendFile(filePath);
    }
};
exports.MissionsChecklistUploadsController = MissionsChecklistUploadsController;
__decorate([
    (0, common_1.Get)(':filename'),
    __param(0, (0, common_1.Param)('filename')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MissionsChecklistUploadsController.prototype, "uploadedPhoto", null);
exports.MissionsChecklistUploadsController = MissionsChecklistUploadsController = __decorate([
    (0, common_1.Controller)('missions/checklist/uploads')
], MissionsChecklistUploadsController);
//# sourceMappingURL=missions.controller.js.map