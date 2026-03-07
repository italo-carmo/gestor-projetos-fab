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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LibraryService = void 0;
const common_1 = require("@nestjs/common");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const sharp_1 = __importDefault(require("sharp"));
const library_storage_1 = require("./library-storage");
const audit_service_1 = require("../audit/audit.service");
const http_error_1 = require("../common/http-error");
const prisma_service_1 = require("../prisma/prisma.service");
const role_access_1 = require("../rbac/role-access");
const library_controller_1 = require("./library.controller");
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const MAX_IMAGE_WIDTH = 1920;
const MAX_IMAGE_HEIGHT = 1080;
const JPEG_QUALITY = 80;
const PNG_QUALITY = 80;
let LibraryService = class LibraryService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async getData() {
        const [photos, documents, settings] = await this.prisma.$transaction([
            this.prisma.libraryPhoto.findMany({
                include: {
                    locality: {
                        select: {
                            id: true,
                            code: true,
                            name: true,
                        },
                    },
                },
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            }),
            this.prisma.libraryDocument.findMany({
                orderBy: [{ createdAt: 'desc' }],
            }),
            this.prisma.librarySetting.findFirst({
                orderBy: { createdAt: 'asc' },
            }),
        ]);
        return {
            photos,
            documents,
            settings: {
                carouselIntervalSeconds: Number(settings?.carouselIntervalSeconds ?? 5),
            },
        };
    }
    ensureEditorAccess(user) {
        if (!(0, role_access_1.hasAnyRole)(user, [role_access_1.ROLE_TI, role_access_1.ROLE_COORDENACAO_CIPAVD])) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
    async updateSettings(payload, user) {
        this.ensureEditorAccess(user);
        const value = Number(payload.carouselIntervalSeconds);
        if (!Number.isFinite(value) || value < 2 || value > 60) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'carouselIntervalSeconds',
                reason: 'out_of_range',
            });
        }
        const settings = await this.prisma.librarySetting.findFirst({
            orderBy: { createdAt: 'asc' },
        });
        const saved = settings
            ? await this.prisma.librarySetting.update({
                where: { id: settings.id },
                data: { carouselIntervalSeconds: Math.floor(value) },
            })
            : await this.prisma.librarySetting.create({
                data: { carouselIntervalSeconds: Math.floor(value) },
            });
        await this.audit.log({
            userId: user?.id,
            resource: 'library',
            action: 'update_settings',
            entityId: saved.id,
            diffJson: {
                carouselIntervalSeconds: saved.carouselIntervalSeconds,
            },
        });
        return saved;
    }
    async createPhoto(file, payload, user) {
        this.ensureEditorAccess(user);
        if (!file) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field: 'file', reason: 'required' });
        }
        const filePath = path.join(library_controller_1.libraryPhotosDir, file.filename);
        let fileBuffer;
        let mimeType;
        try {
            const image = (0, sharp_1.default)(filePath);
            const metadata = await image.metadata();
            const isPng = metadata.format === 'png' && metadata.hasAlpha;
            mimeType = isPng ? 'image/png' : 'image/jpeg';
            let resized = image;
            if (metadata.width && metadata.height) {
                if (metadata.width > MAX_IMAGE_WIDTH || metadata.height > MAX_IMAGE_HEIGHT) {
                    resized = image.resize(MAX_IMAGE_WIDTH, MAX_IMAGE_HEIGHT, {
                        fit: 'inside',
                        withoutEnlargement: true,
                    });
                }
            }
            if (isPng) {
                fileBuffer = await resized.png({ quality: PNG_QUALITY, compressionLevel: 9 }).toBuffer();
            }
            else {
                fileBuffer = await resized.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
                mimeType = 'image/jpeg';
            }
            if (fileBuffer.length > MAX_IMAGE_SIZE) {
                let quality = isPng ? Math.max(60, PNG_QUALITY - 20) : Math.max(60, JPEG_QUALITY - 20);
                let attempts = 0;
                while (fileBuffer.length > MAX_IMAGE_SIZE && attempts < 3) {
                    quality = Math.max(40, quality - 10);
                    if (isPng) {
                        fileBuffer = await image.resize(MAX_IMAGE_WIDTH, MAX_IMAGE_HEIGHT, {
                            fit: 'inside',
                            withoutEnlargement: true,
                        }).png({ quality, compressionLevel: 9 }).toBuffer();
                    }
                    else {
                        fileBuffer = await image.resize(MAX_IMAGE_WIDTH, MAX_IMAGE_HEIGHT, {
                            fit: 'inside',
                            withoutEnlargement: true,
                        }).jpeg({ quality, mozjpeg: true }).toBuffer();
                    }
                    attempts++;
                }
            }
            const base64Data = fileBuffer.toString('base64');
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            catch {
            }
            const currentMaxSortOrder = await this.prisma.libraryPhoto.aggregate({
                _max: { sortOrder: true },
            });
            const nextSortOrder = Number(currentMaxSortOrder._max.sortOrder ?? -1) + 1;
            const title = String(payload.title ?? '').trim();
            const localityId = String(payload.localityId ?? '').trim() || null;
            const created = await this.prisma.libraryPhoto.create({
                data: {
                    title,
                    imageData: base64Data,
                    mimeType,
                    fileUrl: null,
                    storageKey: null,
                    sortOrder: nextSortOrder,
                    localityId,
                    createdById: user?.id,
                },
            });
            await this.audit.log({
                userId: user?.id,
                resource: 'library',
                action: 'create_photo',
                entityId: created.id,
                diffJson: { title: created.title, sortOrder: created.sortOrder, localityId: created.localityId },
            });
            return created;
        }
        catch (error) {
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            catch {
            }
            (0, http_error_1.throwError)('VALIDATION_ERROR', {
                field: 'file',
                reason: 'image_processing_failed',
                message: 'Erro ao processar a imagem. Verifique se o arquivo é uma imagem válida.',
            });
        }
    }
    async updatePhoto(id, payload, user) {
        this.ensureEditorAccess(user);
        const current = await this.prisma.libraryPhoto.findUnique({ where: { id } });
        if (!current)
            (0, http_error_1.throwError)('NOT_FOUND');
        const nextTitle = payload.title === undefined ? current.title : String(payload.title).trim();
        const nextSortOrder = payload.sortOrder === undefined
            ? current.sortOrder
            : Math.max(0, Math.floor(Number(payload.sortOrder) || 0));
        const nextLocalityId = payload.localityId === undefined
            ? current.localityId
            : payload.localityId === null || payload.localityId === ''
                ? null
                : String(payload.localityId).trim() || null;
        const updated = await this.prisma.libraryPhoto.update({
            where: { id },
            data: {
                title: nextTitle,
                sortOrder: nextSortOrder,
                localityId: nextLocalityId,
            },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'library',
            action: 'update_photo',
            entityId: updated.id,
            diffJson: { title: updated.title, sortOrder: updated.sortOrder, localityId: updated.localityId },
        });
        return updated;
    }
    async deletePhoto(id, _photosDir, user) {
        this.ensureEditorAccess(user);
        const current = await this.prisma.libraryPhoto.findUnique({ where: { id } });
        if (!current)
            (0, http_error_1.throwError)('NOT_FOUND');
        await this.prisma.libraryPhoto.delete({ where: { id } });
        await this.audit.log({
            userId: user?.id,
            resource: 'library',
            action: 'delete_photo',
            entityId: id,
            diffJson: { title: current.title },
        });
        return { success: true };
    }
    async createDocument(file, payload, user) {
        this.ensureEditorAccess(user);
        if (!file) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field: 'file', reason: 'required' });
        }
        const title = String(payload.title ?? '').trim() || file.originalname || 'Documento';
        const created = await this.prisma.libraryDocument.create({
            data: {
                title,
                fileName: file.originalname || file.filename,
                fileUrl: `/library/uploads/documents/${file.filename}`,
                storageKey: file.filename,
                mimeType: file.mimetype || null,
                fileSize: Number.isFinite(file.size) ? file.size : null,
                createdById: user?.id,
            },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'library',
            action: 'create_document',
            entityId: created.id,
            diffJson: { title: created.title, fileName: created.fileName },
        });
        return created;
    }
    async updateDocument(id, payload, user) {
        this.ensureEditorAccess(user);
        const current = await this.prisma.libraryDocument.findUnique({ where: { id } });
        if (!current)
            (0, http_error_1.throwError)('NOT_FOUND');
        const nextTitle = payload.title === undefined ? current.title : String(payload.title).trim();
        if (!nextTitle) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field: 'title', reason: 'required' });
        }
        const updated = await this.prisma.libraryDocument.update({
            where: { id },
            data: { title: nextTitle },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'library',
            action: 'update_document',
            entityId: updated.id,
            diffJson: { title: updated.title },
        });
        return updated;
    }
    async deleteDocument(id, documentsDir, user) {
        this.ensureEditorAccess(user);
        const current = await this.prisma.libraryDocument.findUnique({ where: { id } });
        if (!current)
            (0, http_error_1.throwError)('NOT_FOUND');
        await this.prisma.libraryDocument.delete({ where: { id } });
        const storageKey = String(current.storageKey ?? '').trim();
        if (storageKey) {
            const filePath = (0, library_storage_1.resolveExistingLibraryDocumentPath)(storageKey) || path.join(documentsDir, storageKey);
            try {
                if (fs.existsSync(filePath))
                    fs.unlinkSync(filePath);
            }
            catch {
            }
        }
        await this.audit.log({
            userId: user?.id,
            resource: 'library',
            action: 'delete_document',
            entityId: id,
            diffJson: { title: current.title, fileName: current.fileName },
        });
        return { success: true };
    }
    async getDocumentById(id) {
        const document = await this.prisma.libraryDocument.findUnique({ where: { id } });
        if (!document)
            (0, http_error_1.throwError)('NOT_FOUND');
        return document;
    }
};
exports.LibraryService = LibraryService;
exports.LibraryService = LibraryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], LibraryService);
//# sourceMappingURL=library.service.js.map