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
exports.CreateSocialCommunicationHighlightDto = exports.SocialCommunicationHighlightImpactDto = void 0;
const class_validator_1 = require("class-validator");
var SocialCommunicationHighlightImpactDto;
(function (SocialCommunicationHighlightImpactDto) {
    SocialCommunicationHighlightImpactDto["MULTIPLICADOR"] = "MULTIPLICADOR";
    SocialCommunicationHighlightImpactDto["SIMBOLICO"] = "SIMBOLICO";
})(SocialCommunicationHighlightImpactDto || (exports.SocialCommunicationHighlightImpactDto = SocialCommunicationHighlightImpactDto = {}));
class CreateSocialCommunicationHighlightDto {
    ldapUid;
    militaryEmail;
    militaryName;
    highlightRole;
    fabom;
    photoMimeType;
    photoBase64;
    impact;
    localityId;
    text;
}
exports.CreateSocialCommunicationHighlightDto = CreateSocialCommunicationHighlightDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateSocialCommunicationHighlightDto.prototype, "ldapUid", void 0);
__decorate([
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", String)
], CreateSocialCommunicationHighlightDto.prototype, "militaryEmail", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(180),
    __metadata("design:type", String)
], CreateSocialCommunicationHighlightDto.prototype, "militaryName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(140),
    __metadata("design:type", String)
], CreateSocialCommunicationHighlightDto.prototype, "highlightRole", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], CreateSocialCommunicationHighlightDto.prototype, "fabom", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateSocialCommunicationHighlightDto.prototype, "photoMimeType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4_000_000),
    __metadata("design:type", String)
], CreateSocialCommunicationHighlightDto.prototype, "photoBase64", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(SocialCommunicationHighlightImpactDto),
    __metadata("design:type", String)
], CreateSocialCommunicationHighlightDto.prototype, "impact", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], CreateSocialCommunicationHighlightDto.prototype, "localityId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], CreateSocialCommunicationHighlightDto.prototype, "text", void 0);
//# sourceMappingURL=create-social-communication-highlight.dto.js.map