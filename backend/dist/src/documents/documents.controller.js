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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentsController = void 0;
const common_1 = require("@nestjs/common");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../common/current-user.decorator");
const http_error_1 = require("../common/http-error");
const require_permission_decorator_1 = require("../rbac/require-permission.decorator");
const rbac_guard_1 = require("../rbac/rbac.guard");
const documents_service_1 = require("./documents.service");
const create_document_subcategory_dto_1 = require("./dto/create-document-subcategory.dto");
const update_document_subcategory_dto_1 = require("./dto/update-document-subcategory.dto");
const update_document_dto_1 = require("./dto/update-document.dto");
const create_document_link_dto_1 = require("./dto/create-document-link.dto");
const update_document_link_dto_1 = require("./dto/update-document-link.dto");
const documentsDir = node_path_1.default.resolve(process.cwd(), 'storage', 'documents');
if (!node_fs_1.default.existsSync(documentsDir)) {
    node_fs_1.default.mkdirSync(documentsDir, { recursive: true });
}
let DocumentsController = class DocumentsController {
    documents;
    constructor(documents) {
        this.documents = documents;
    }
    list(q, category, subcategoryId, localityId, page, pageSize, user) {
        return this.documents.list({ q, category, subcategoryId, localityId, page, pageSize }, user);
    }
    listSubcategories(category, user) {
        return this.documents.listSubcategories({ category }, user);
    }
    createSubcategory(dto, user) {
        return this.documents.createSubcategory(dto, user);
    }
    updateSubcategory(id, dto, user) {
        return this.documents.updateSubcategory(id, dto, user);
    }
    deleteSubcategory(id, user) {
        return this.documents.deleteSubcategory(id, user);
    }
    coverage(user) {
        return this.documents.coverage(user);
    }
    listLinks(documentId, entityType, entityId, pageSize, user) {
        return this.documents.listLinks({ documentId, entityType, entityId, pageSize }, user);
    }
    createLink(dto, user) {
        return this.documents.createLink(dto, user);
    }
    updateLink(linkId, dto, user) {
        return this.documents.updateLink(linkId, dto, user);
    }
    deleteLink(linkId, user) {
        return this.documents.deleteLink(linkId, user);
    }
    linkCandidates(entityType, q, pageSize, user) {
        return this.documents.listLinkCandidates({ entityType, q, pageSize }, user);
    }
    getContent(id, user) {
        return this.documents.getContent(id, user);
    }
    getById(id, user) {
        return this.documents.getById(id, user);
    }
    update(id, dto, user) {
        return this.documents.update(id, dto, user);
    }
    async download(id, user, res) {
        const document = await this.documents.getById(id, user);
        const fileName = document.storageKey ?? node_path_1.default.basename(document.fileUrl);
        const filePath = node_path_1.default.join(documentsDir, fileName);
        if (!node_fs_1.default.existsSync(filePath)) {
            (0, http_error_1.throwError)('NOT_FOUND');
        }
        return res.download(filePath, document.fileName);
    }
};
exports.DocumentsController = DocumentsController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('search', 'view'),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)('category')),
    __param(2, (0, common_1.Query)('subcategoryId')),
    __param(3, (0, common_1.Query)('localityId')),
    __param(4, (0, common_1.Query)('page')),
    __param(5, (0, common_1.Query)('pageSize')),
    __param(6, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('subcategories'),
    (0, require_permission_decorator_1.RequirePermission)('search', 'view'),
    __param(0, (0, common_1.Query)('category')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "listSubcategories", null);
__decorate([
    (0, common_1.Post)('subcategories'),
    (0, require_permission_decorator_1.RequirePermission)('search', 'view'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_document_subcategory_dto_1.CreateDocumentSubcategoryDto, Object]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "createSubcategory", null);
__decorate([
    (0, common_1.Put)('subcategories/:id'),
    (0, require_permission_decorator_1.RequirePermission)('search', 'view'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_document_subcategory_dto_1.UpdateDocumentSubcategoryDto, Object]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "updateSubcategory", null);
__decorate([
    (0, common_1.Delete)('subcategories/:id'),
    (0, require_permission_decorator_1.RequirePermission)('search', 'view'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "deleteSubcategory", null);
__decorate([
    (0, common_1.Get)('coverage'),
    (0, require_permission_decorator_1.RequirePermission)('search', 'view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "coverage", null);
__decorate([
    (0, common_1.Get)('links'),
    (0, require_permission_decorator_1.RequirePermission)('search', 'view'),
    __param(0, (0, common_1.Query)('documentId')),
    __param(1, (0, common_1.Query)('entityType')),
    __param(2, (0, common_1.Query)('entityId')),
    __param(3, (0, common_1.Query)('pageSize')),
    __param(4, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "listLinks", null);
__decorate([
    (0, common_1.Post)('links'),
    (0, require_permission_decorator_1.RequirePermission)('search', 'view'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_document_link_dto_1.CreateDocumentLinkDto, Object]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "createLink", null);
__decorate([
    (0, common_1.Put)('links/:linkId'),
    (0, require_permission_decorator_1.RequirePermission)('search', 'view'),
    __param(0, (0, common_1.Param)('linkId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_document_link_dto_1.UpdateDocumentLinkDto, Object]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "updateLink", null);
__decorate([
    (0, common_1.Delete)('links/:linkId'),
    (0, require_permission_decorator_1.RequirePermission)('search', 'view'),
    __param(0, (0, common_1.Param)('linkId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "deleteLink", null);
__decorate([
    (0, common_1.Get)('link-candidates'),
    (0, require_permission_decorator_1.RequirePermission)('search', 'view'),
    __param(0, (0, common_1.Query)('entityType')),
    __param(1, (0, common_1.Query)('q')),
    __param(2, (0, common_1.Query)('pageSize')),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "linkCandidates", null);
__decorate([
    (0, common_1.Get)(':id/content'),
    (0, require_permission_decorator_1.RequirePermission)('search', 'view'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "getContent", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('search', 'view'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "getById", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('search', 'view'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_document_dto_1.UpdateDocumentDto, Object]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "update", null);
__decorate([
    (0, common_1.Get)(':id/download'),
    (0, require_permission_decorator_1.RequirePermission)('search', 'view'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], DocumentsController.prototype, "download", null);
exports.DocumentsController = DocumentsController = __decorate([
    (0, common_1.Controller)('documents'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [documents_service_1.DocumentsService])
], DocumentsController);
//# sourceMappingURL=documents.controller.js.map