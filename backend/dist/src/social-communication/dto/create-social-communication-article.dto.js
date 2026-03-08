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
exports.CreateSocialCommunicationArticleDto = exports.SocialCommunicationAudience = void 0;
const class_validator_1 = require("class-validator");
var SocialCommunicationAudience;
(function (SocialCommunicationAudience) {
    SocialCommunicationAudience["INTERNAL"] = "INTERNAL";
    SocialCommunicationAudience["EXTERNAL"] = "EXTERNAL";
})(SocialCommunicationAudience || (exports.SocialCommunicationAudience = SocialCommunicationAudience = {}));
class CreateSocialCommunicationArticleDto {
    url;
    title;
    coverImageUrl;
    summary;
    publishedAt;
    tags;
    audience;
}
exports.CreateSocialCommunicationArticleDto = CreateSocialCommunicationArticleDto;
__decorate([
    (0, class_validator_1.IsUrl)({ require_protocol: true }, { message: 'url must be a valid URL' }),
    __metadata("design:type", String)
], CreateSocialCommunicationArticleDto.prototype, "url", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSocialCommunicationArticleDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], CreateSocialCommunicationArticleDto.prototype, "coverImageUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], CreateSocialCommunicationArticleDto.prototype, "summary", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], CreateSocialCommunicationArticleDto.prototype, "publishedAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateSocialCommunicationArticleDto.prototype, "tags", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(SocialCommunicationAudience),
    __metadata("design:type", String)
], CreateSocialCommunicationArticleDto.prototype, "audience", void 0);
//# sourceMappingURL=create-social-communication-article.dto.js.map