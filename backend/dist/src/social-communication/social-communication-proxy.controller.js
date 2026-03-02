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
exports.SocialCommunicationProxyController = void 0;
const common_1 = require("@nestjs/common");
const social_communication_service_1 = require("./social-communication.service");
let SocialCommunicationProxyController = class SocialCommunicationProxyController {
    socialCommunication;
    constructor(socialCommunication) {
        this.socialCommunication = socialCommunication;
    }
    async content(articleId, exp, sig, res) {
        const payload = await this.socialCommunication.getPublicContent(articleId, exp, sig);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=600');
        return res.send(payload.html);
    }
    async cover(articleId, exp, sig, res) {
        const payload = await this.socialCommunication.getPublicCover(articleId, exp, sig);
        res.setHeader('Content-Type', payload.contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.send(payload.buffer);
    }
    async asset(url, exp, sig, res) {
        const payload = await this.socialCommunication.getPublicAsset(url, exp, sig);
        res.setHeader('Content-Type', payload.contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.send(payload.buffer);
    }
    async page(url, exp, sig, res) {
        const payload = await this.socialCommunication.getPublicPage(url, exp, sig);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=600');
        return res.send(payload.html);
    }
};
exports.SocialCommunicationProxyController = SocialCommunicationProxyController;
__decorate([
    (0, common_1.Get)('content'),
    __param(0, (0, common_1.Query)('articleId')),
    __param(1, (0, common_1.Query)('exp')),
    __param(2, (0, common_1.Query)('sig')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], SocialCommunicationProxyController.prototype, "content", null);
__decorate([
    (0, common_1.Get)('cover'),
    __param(0, (0, common_1.Query)('articleId')),
    __param(1, (0, common_1.Query)('exp')),
    __param(2, (0, common_1.Query)('sig')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], SocialCommunicationProxyController.prototype, "cover", null);
__decorate([
    (0, common_1.Get)('asset'),
    __param(0, (0, common_1.Query)('url')),
    __param(1, (0, common_1.Query)('exp')),
    __param(2, (0, common_1.Query)('sig')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], SocialCommunicationProxyController.prototype, "asset", null);
__decorate([
    (0, common_1.Get)('page'),
    __param(0, (0, common_1.Query)('url')),
    __param(1, (0, common_1.Query)('exp')),
    __param(2, (0, common_1.Query)('sig')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], SocialCommunicationProxyController.prototype, "page", null);
exports.SocialCommunicationProxyController = SocialCommunicationProxyController = __decorate([
    (0, common_1.Controller)('social-communication/proxy'),
    __metadata("design:paramtypes", [social_communication_service_1.SocialCommunicationService])
], SocialCommunicationProxyController);
//# sourceMappingURL=social-communication-proxy.controller.js.map