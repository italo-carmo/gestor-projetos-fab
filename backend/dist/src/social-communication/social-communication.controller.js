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
exports.SocialCommunicationController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../common/current-user.decorator");
const rbac_guard_1 = require("../rbac/rbac.guard");
const create_social_communication_article_dto_1 = require("./dto/create-social-communication-article.dto");
const resolve_social_communication_metadata_dto_1 = require("./dto/resolve-social-communication-metadata.dto");
const update_social_communication_article_dto_1 = require("./dto/update-social-communication-article.dto");
const social_communication_service_1 = require("./social-communication.service");
let SocialCommunicationController = class SocialCommunicationController {
    socialCommunication;
    constructor(socialCommunication) {
        this.socialCommunication = socialCommunication;
    }
    list(q, tag) {
        const tags = Array.isArray(tag) ? tag : tag ? [tag] : undefined;
        return this.socialCommunication.list({ q, tags });
    }
    resolveMetadata(dto, user) {
        return this.socialCommunication.resolveMetadata(dto.url, user);
    }
    create(dto, user) {
        return this.socialCommunication.create(dto, user);
    }
    update(id, dto, user) {
        return this.socialCommunication.update(id, dto, user);
    }
    remove(id, user) {
        return this.socialCommunication.remove(id, user);
    }
};
exports.SocialCommunicationController = SocialCommunicationController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)('tag')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SocialCommunicationController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('metadata'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [resolve_social_communication_metadata_dto_1.ResolveSocialCommunicationMetadataDto, Object]),
    __metadata("design:returntype", void 0)
], SocialCommunicationController.prototype, "resolveMetadata", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_social_communication_article_dto_1.CreateSocialCommunicationArticleDto, Object]),
    __metadata("design:returntype", void 0)
], SocialCommunicationController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_social_communication_article_dto_1.UpdateSocialCommunicationArticleDto, Object]),
    __metadata("design:returntype", void 0)
], SocialCommunicationController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SocialCommunicationController.prototype, "remove", null);
exports.SocialCommunicationController = SocialCommunicationController = __decorate([
    (0, common_1.Controller)('social-communication'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [social_communication_service_1.SocialCommunicationService])
], SocialCommunicationController);
//# sourceMappingURL=social-communication.controller.js.map