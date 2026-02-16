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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateMeetingDto = void 0;
const class_validator_1 = require("class-validator");
class CreateMeetingDto {
    datetime;
    scope;
    status;
    meetingType;
    meetingLink;
    agenda;
    localityId;
    participantIds;
}
exports.CreateMeetingDto = CreateMeetingDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateMeetingDto.prototype, "datetime", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMeetingDto.prototype, "scope", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(['PLANNED', 'HELD', 'CANCELLED']),
    __metadata("design:type", String)
], CreateMeetingDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(['ONLINE', 'PRESENCIAL']),
    __metadata("design:type", String)
], CreateMeetingDto.prototype, "meetingType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], CreateMeetingDto.prototype, "meetingLink", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], CreateMeetingDto.prototype, "agenda", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], CreateMeetingDto.prototype, "localityId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], CreateMeetingDto.prototype, "participantIds", void 0);
//# sourceMappingURL=create-meeting.dto.js.map