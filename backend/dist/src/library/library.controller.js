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
exports.LibraryController = exports.libraryDocumentsDir = exports.libraryPhotosDir = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const node_crypto_1 = require("node:crypto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../common/current-user.decorator");
const require_permission_decorator_1 = require("../rbac/require-permission.decorator");
const rbac_guard_1 = require("../rbac/rbac.guard");
const multer_exception_filter_1 = require("../reports/multer-exception.filter");
const library_service_1 = require("./library.service");
const library_storage_1 = require("./library-storage");
exports.libraryPhotosDir = path.resolve(process.cwd(), 'storage', 'library-photos');
exports.libraryDocumentsDir = path.resolve((0, library_storage_1.getLibraryDocumentsDir)());
if (!fs.existsSync(exports.libraryPhotosDir)) {
    fs.mkdirSync(exports.libraryPhotosDir, { recursive: true });
}
if (!fs.existsSync(exports.libraryDocumentsDir)) {
    fs.mkdirSync(exports.libraryDocumentsDir, { recursive: true });
}
let LibraryController = class LibraryController {
    library;
    constructor(library) {
        this.library = library;
    }
    list(scope) {
        return this.library.getData(scope);
    }
    updateSettings(body, user) {
        return this.library.updateSettings({ carouselIntervalSeconds: body.carouselIntervalSeconds }, user);
    }
    uploadPhoto(file, body, user) {
        return this.library.createPhoto(file, body, user);
    }
    updatePhoto(id, body, user) {
        return this.library.updatePhoto(id, body, user);
    }
    deletePhoto(id, user) {
        return this.library.deletePhoto(id, '', user);
    }
    uploadDocument(file, body, user) {
        return this.library.createDocument(file, body, user);
    }
    updateDocument(id, body, user) {
        return this.library.updateDocument(id, body, user);
    }
    deleteDocument(id, user) {
        return this.library.deleteDocument(id, exports.libraryDocumentsDir, user);
    }
    async downloadDocument(id, res) {
        const document = await this.library.getDocumentById(id);
        const storageKey = String(document.storageKey ?? '').trim() ||
            path.basename(String(document.fileUrl ?? '').trim());
        const filePath = (0, library_storage_1.resolveExistingLibraryDocumentPath)(storageKey);
        if (!filePath) {
            return res.status(404).json({
                message: 'Arquivo indisponível para download.',
                code: 'NOT_FOUND',
            });
        }
        res.setHeader('Cache-Control', 'private, no-store');
        return res.download(filePath, document.fileName || document.title || 'publicacao');
    }
};
exports.LibraryController = LibraryController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('library', 'view'),
    __param(0, (0, common_1.Query)('scope')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LibraryController.prototype, "list", null);
__decorate([
    (0, common_1.Put)('settings'),
    (0, require_permission_decorator_1.RequirePermission)('library', 'update'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], LibraryController.prototype, "updateSettings", null);
__decorate([
    (0, common_1.Post)('photos/upload'),
    (0, require_permission_decorator_1.RequirePermission)('library', 'create'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: exports.libraryPhotosDir,
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
        limits: { fileSize: 10 * 1024 * 1024 },
    })),
    (0, common_1.UseFilters)(multer_exception_filter_1.MulterExceptionFilter),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", void 0)
], LibraryController.prototype, "uploadPhoto", null);
__decorate([
    (0, common_1.Put)('photos/:id'),
    (0, require_permission_decorator_1.RequirePermission)('library', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], LibraryController.prototype, "updatePhoto", null);
__decorate([
    (0, common_1.Delete)('photos/:id'),
    (0, require_permission_decorator_1.RequirePermission)('library', 'delete'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], LibraryController.prototype, "deletePhoto", null);
__decorate([
    (0, common_1.Post)('documents/upload'),
    (0, require_permission_decorator_1.RequirePermission)('library', 'create'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: exports.libraryDocumentsDir,
            filename: (_req, file, cb) => {
                const extension = path.extname(file.originalname || '').toLowerCase();
                const safeExtension = extension && extension.length <= 10 ? extension : '.bin';
                cb(null, `${Date.now()}-${(0, node_crypto_1.randomUUID)()}${safeExtension}`);
            },
        }),
        limits: { fileSize: 20 * 1024 * 1024 },
    })),
    (0, common_1.UseFilters)(multer_exception_filter_1.MulterExceptionFilter),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", void 0)
], LibraryController.prototype, "uploadDocument", null);
__decorate([
    (0, common_1.Put)('documents/:id'),
    (0, require_permission_decorator_1.RequirePermission)('library', 'update'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], LibraryController.prototype, "updateDocument", null);
__decorate([
    (0, common_1.Delete)('documents/:id'),
    (0, require_permission_decorator_1.RequirePermission)('library', 'delete'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], LibraryController.prototype, "deleteDocument", null);
__decorate([
    (0, common_1.Get)('documents/:id/download'),
    (0, require_permission_decorator_1.RequirePermission)('library', 'download'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], LibraryController.prototype, "downloadDocument", null);
exports.LibraryController = LibraryController = __decorate([
    (0, common_1.Controller)('library'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [library_service_1.LibraryService])
], LibraryController);
//# sourceMappingURL=library.controller.js.map