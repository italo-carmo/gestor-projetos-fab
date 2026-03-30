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
exports.UpsertMissionChecklistDto = exports.UpsertMissionChecklistItemDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const mission_checklist_constants_1 = require("../mission-checklist.constants");
class UpsertMissionChecklistItemDto {
    id;
    classification;
    notes;
    photos;
}
exports.UpsertMissionChecklistItemDto = UpsertMissionChecklistItemDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], UpsertMissionChecklistItemDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(mission_checklist_constants_1.MISSION_CHECKLIST_CLASSIFICATIONS),
    __metadata("design:type", Object)
], UpsertMissionChecklistItemDto.prototype, "classification", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], UpsertMissionChecklistItemDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(500, { each: true }),
    __metadata("design:type", Array)
], UpsertMissionChecklistItemDto.prototype, "photos", void 0);
class UpsertMissionChecklistDto {
    omId;
    items;
}
exports.UpsertMissionChecklistDto = UpsertMissionChecklistDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], UpsertMissionChecklistDto.prototype, "omId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UpsertMissionChecklistItemDto),
    __metadata("design:type", Array)
], UpsertMissionChecklistDto.prototype, "items", void 0);
//# sourceMappingURL=upsert-mission-checklist.dto.js.map