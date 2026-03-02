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
exports.MissionsController = void 0;
const common_1 = require("@nestjs/common");
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
//# sourceMappingURL=missions.controller.js.map