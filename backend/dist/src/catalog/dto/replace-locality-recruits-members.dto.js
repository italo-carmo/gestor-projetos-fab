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
exports.ReplaceLocalityRecruitsMembersDto = exports.ReplaceLocalityRecruitMemberItemDto = exports.RecruitMemberStatusDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
var RecruitMemberStatusDto;
(function (RecruitMemberStatusDto) {
    RecruitMemberStatusDto["RECRUITMENT_TO_START"] = "RECRUITMENT_TO_START";
    RecruitMemberStatusDto["RECRUITMENT_STARTED"] = "RECRUITMENT_STARTED";
    RecruitMemberStatusDto["DISMISSED"] = "DISMISSED";
    RecruitMemberStatusDto["ASSIGNED_TO_OM"] = "ASSIGNED_TO_OM";
})(RecruitMemberStatusDto || (exports.RecruitMemberStatusDto = RecruitMemberStatusDto = {}));
class ReplaceLocalityRecruitMemberItemDto {
    id;
    name;
    status;
    dismissalReason;
    destinationLocalityId;
}
exports.ReplaceLocalityRecruitMemberItemDto = ReplaceLocalityRecruitMemberItemDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReplaceLocalityRecruitMemberItemDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReplaceLocalityRecruitMemberItemDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(RecruitMemberStatusDto),
    __metadata("design:type", String)
], ReplaceLocalityRecruitMemberItemDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], ReplaceLocalityRecruitMemberItemDto.prototype, "dismissalReason", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], ReplaceLocalityRecruitMemberItemDto.prototype, "destinationLocalityId", void 0);
class ReplaceLocalityRecruitsMembersDto {
    items;
}
exports.ReplaceLocalityRecruitsMembersDto = ReplaceLocalityRecruitsMembersDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(2000),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ReplaceLocalityRecruitMemberItemDto),
    __metadata("design:type", Array)
], ReplaceLocalityRecruitsMembersDto.prototype, "items", void 0);
//# sourceMappingURL=replace-locality-recruits-members.dto.js.map