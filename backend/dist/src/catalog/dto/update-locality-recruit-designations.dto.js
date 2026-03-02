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
exports.UpdateLocalityRecruitDesignationsDto = exports.RecruitDesignationItemDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class RecruitDesignationItemDto {
    destinationLocalityId;
    assignedCount;
}
exports.RecruitDesignationItemDto = RecruitDesignationItemDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RecruitDesignationItemDto.prototype, "destinationLocalityId", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], RecruitDesignationItemDto.prototype, "assignedCount", void 0);
class UpdateLocalityRecruitDesignationsDto {
    items;
}
exports.UpdateLocalityRecruitDesignationsDto = UpdateLocalityRecruitDesignationsDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(500),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => RecruitDesignationItemDto),
    __metadata("design:type", Array)
], UpdateLocalityRecruitDesignationsDto.prototype, "items", void 0);
//# sourceMappingURL=update-locality-recruit-designations.dto.js.map