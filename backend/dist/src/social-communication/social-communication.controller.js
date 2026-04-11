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
exports.SocialCommunicationController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../common/current-user.decorator");
const require_permission_decorator_1 = require("../rbac/require-permission.decorator");
const rbac_guard_1 = require("../rbac/rbac.guard");
const create_social_communication_article_dto_1 = require("./dto/create-social-communication-article.dto");
const create_social_communication_highlight_dto_1 = require("./dto/create-social-communication-highlight.dto");
const lookup_social_communication_highlight_ldap_dto_1 = require("./dto/lookup-social-communication-highlight-ldap.dto");
const resolve_social_communication_metadata_dto_1 = require("./dto/resolve-social-communication-metadata.dto");
const update_social_communication_article_dto_1 = require("./dto/update-social-communication-article.dto");
const update_social_communication_highlight_dto_1 = require("./dto/update-social-communication-highlight.dto");
const social_communication_service_1 = require("./social-communication.service");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const node_crypto_1 = require("node:crypto");
const multer_exception_filter_1 = require("../reports/multer-exception.filter");
const http_error_1 = require("../common/http-error");
const social_communication_storage_1 = require("./social-communication-storage");
const uploadDir = (0, social_communication_storage_1.getSocialCommunicationCoversDir)();
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
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
    listHighlights(q) {
        return this.socialCommunication.listHighlights({ q });
    }
    lookupHighlightLdapProfile(query, user) {
        return this.socialCommunication.lookupHighlightLdapProfile(query.email, user);
    }
    createHighlight(dto, user) {
        return this.socialCommunication.createHighlight(dto, user);
    }
    create(dto, user) {
        return this.socialCommunication.create(dto, user);
    }
    async uploadCover(file, user) {
        this.socialCommunication.ensureEditorAccess(user);
        if (!file) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field: 'file', reason: 'required' });
        }
        return { coverImageUrl: `/social-communication/uploads/${file.filename}` };
    }
    update(id, dto, user) {
        return this.socialCommunication.update(id, dto, user);
    }
    updateHighlight(id, dto, user) {
        return this.socialCommunication.updateHighlight(id, dto, user);
    }
    remove(id, user) {
        return this.socialCommunication.remove(id, user);
    }
    removeHighlight(id, user) {
        return this.socialCommunication.removeHighlight(id, user);
    }
};
exports.SocialCommunicationController = SocialCommunicationController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('social_communication', 'view'),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)('tag')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SocialCommunicationController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('metadata'),
    (0, require_permission_decorator_1.RequirePermission)('social_communication', 'create'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [resolve_social_communication_metadata_dto_1.ResolveSocialCommunicationMetadataDto, Object]),
    __metadata("design:returntype", void 0)
], SocialCommunicationController.prototype, "resolveMetadata", null);
__decorate([
    (0, common_1.Get)('highlights'),
    (0, require_permission_decorator_1.RequirePermission)('social_communication_highlight', 'view'),
    __param(0, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SocialCommunicationController.prototype, "listHighlights", null);
__decorate([
    (0, common_1.Get)('highlights/ldap-profile'),
    (0, require_permission_decorator_1.RequirePermission)('social_communication_highlight', 'create'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [lookup_social_communication_highlight_ldap_dto_1.LookupSocialCommunicationHighlightLdapDto, Object]),
    __metadata("design:returntype", void 0)
], SocialCommunicationController.prototype, "lookupHighlightLdapProfile", null);
__decorate([
    (0, common_1.Post)('highlights'),
    (0, require_permission_decorator_1.RequirePermission)('social_communication_highlight', 'create'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_social_communication_highlight_dto_1.CreateSocialCommunicationHighlightDto, Object]),
    __metadata("design:returntype", void 0)
], SocialCommunicationController.prototype, "createHighlight", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)('social_communication', 'create'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_social_communication_article_dto_1.CreateSocialCommunicationArticleDto, Object]),
    __metadata("design:returntype", void 0)
], SocialCommunicationController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('upload-cover'),
    (0, require_permission_decorator_1.RequirePermission)('social_communication', 'upload'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: uploadDir,
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
        limits: { fileSize: 5 * 1024 * 1024 },
    })),
    (0, common_1.UseFilters)(multer_exception_filter_1.MulterExceptionFilter),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SocialCommunicationController.prototype, "uploadCover", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('social_communication', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_social_communication_article_dto_1.UpdateSocialCommunicationArticleDto, Object]),
    __metadata("design:returntype", void 0)
], SocialCommunicationController.prototype, "update", null);
__decorate([
    (0, common_1.Put)('highlights/:id'),
    (0, require_permission_decorator_1.RequirePermission)('social_communication_highlight', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_social_communication_highlight_dto_1.UpdateSocialCommunicationHighlightDto, Object]),
    __metadata("design:returntype", void 0)
], SocialCommunicationController.prototype, "updateHighlight", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('social_communication', 'delete'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SocialCommunicationController.prototype, "remove", null);
__decorate([
    (0, common_1.Delete)('highlights/:id'),
    (0, require_permission_decorator_1.RequirePermission)('social_communication_highlight', 'delete'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SocialCommunicationController.prototype, "removeHighlight", null);
exports.SocialCommunicationController = SocialCommunicationController = __decorate([
    (0, common_1.Controller)('social-communication'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [social_communication_service_1.SocialCommunicationService])
], SocialCommunicationController);
//# sourceMappingURL=social-communication.controller.js.map