import { Injectable } from '@nestjs/common';
import { LocalityCatalogType } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import { resolveExistingLibraryDocumentPath } from './library-storage';
import { AuditService } from '../audit/audit.service';
import { throwError } from '../common/http-error';
import { PrismaService } from '../prisma/prisma.service';
import { hasPermission } from '../rbac/role-access';
import type { RbacUser } from '../rbac/rbac.types';
import { libraryPhotosDir } from './library.controller';

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB máximo para base64 (após compressão)
const MAX_IMAGE_WIDTH = 1920;
const MAX_IMAGE_HEIGHT = 1080;
const JPEG_QUALITY = 80;
const PNG_QUALITY = 80;
type LibraryScope = 'SMIF' | 'CIPAVD';

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getData(scopeRaw?: string) {
    const scope = this.parseScope(scopeRaw);
    const localityCatalogType =
      scope === 'CIPAVD' ? LocalityCatalogType.CIPAVD : LocalityCatalogType.SMIF;
    const [photos, documents, settings, localities] = await this.prisma.$transaction([
      this.prisma.libraryPhoto.findMany({
        where: { scope },
        include: {
          locality: {
            select: {
              id: true,
              code: true,
              name: true,
              catalogType: true,
            },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.libraryDocument.findMany({
        where: { scope },
        orderBy: [{ createdAt: 'desc' }],
      }),
      this.prisma.librarySetting.findFirst({
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.locality.findMany({
        where: { catalogType: localityCatalogType },
        select: { id: true, code: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return {
      scope,
      photos,
      documents,
      localities,
      settings: {
        carouselIntervalSeconds: Number(settings?.carouselIntervalSeconds ?? 5),
      },
    };
  }

  ensureEditorAccess(
    user: RbacUser | undefined,
    action: 'create' | 'update' | 'delete',
  ) {
    if (!hasPermission(user, 'library', action)) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  async updateSettings(
    payload: { carouselIntervalSeconds: number },
    user?: RbacUser,
  ) {
    this.ensureEditorAccess(user, 'update');
    const value = Number(payload.carouselIntervalSeconds);
    if (!Number.isFinite(value) || value < 2 || value > 60) {
      throwError('VALIDATION_ERROR', {
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

  async createPhoto(
    file: Express.Multer.File,
    payload: { title?: string; localityId?: string; scope?: string },
    user?: RbacUser,
  ) {
    this.ensureEditorAccess(user, 'create');
    if (!file) {
      throwError('VALIDATION_ERROR', { field: 'file', reason: 'required' });
    }

    const filePath = path.join(libraryPhotosDir, file.filename);
    let fileBuffer: Buffer;
    let mimeType: string;

    try {
      // Read and compress image
      const image = sharp(filePath);
      const metadata = await image.metadata();

      // Determine output format (convert to JPEG for better compression, except for PNG with transparency)
      const isPng = metadata.format === 'png' && metadata.hasAlpha;
      mimeType = isPng ? 'image/png' : 'image/jpeg';

      // Resize if needed (maintain aspect ratio)
      let resized = image;
      if (metadata.width && metadata.height) {
        if (
          metadata.width > MAX_IMAGE_WIDTH ||
          metadata.height > MAX_IMAGE_HEIGHT
        ) {
          resized = image.resize(MAX_IMAGE_WIDTH, MAX_IMAGE_HEIGHT, {
            fit: 'inside',
            withoutEnlargement: true,
          });
        }
      }

      // Compress image
      if (isPng) {
        fileBuffer = await resized
          .png({ quality: PNG_QUALITY, compressionLevel: 9 })
          .toBuffer();
      } else {
        fileBuffer = await resized
          .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
          .toBuffer();
        mimeType = 'image/jpeg';
      }

      // Check final size (should be under 2MB after compression)
      if (fileBuffer.length > MAX_IMAGE_SIZE) {
        // If still too large, reduce quality further
        let quality = isPng
          ? Math.max(60, PNG_QUALITY - 20)
          : Math.max(60, JPEG_QUALITY - 20);
        let attempts = 0;
        while (fileBuffer.length > MAX_IMAGE_SIZE && attempts < 3) {
          quality = Math.max(40, quality - 10);
          if (isPng) {
            fileBuffer = await image
              .resize(MAX_IMAGE_WIDTH, MAX_IMAGE_HEIGHT, {
                fit: 'inside',
                withoutEnlargement: true,
              })
              .png({ quality, compressionLevel: 9 })
              .toBuffer();
          } else {
            fileBuffer = await image
              .resize(MAX_IMAGE_WIDTH, MAX_IMAGE_HEIGHT, {
                fit: 'inside',
                withoutEnlargement: true,
              })
              .jpeg({ quality, mozjpeg: true })
              .toBuffer();
          }
          attempts++;
        }
      }

      // Convert to base64
      const base64Data = fileBuffer.toString('base64');

      // Clean up uploaded file since we're storing in DB
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {
        // Ignore cleanup errors
      }

      const title = String(payload.title ?? '').trim();
      const localityId = String(payload.localityId ?? '').trim() || null;
      const scope = this.parseScope(payload.scope);
      const currentMaxSortOrder = await this.prisma.libraryPhoto.aggregate({
        where: { scope },
        _max: { sortOrder: true },
      });
      const nextSortOrder =
        Number(currentMaxSortOrder._max.sortOrder ?? -1) + 1;
      await this.assertLocalityForScope(localityId, scope);

      const created = await this.prisma.libraryPhoto.create({
        data: {
          title,
          scope,
          imageData: base64Data,
          mimeType,
          fileUrl: null, // No longer used
          storageKey: null, // No longer used
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
        diffJson: {
          title: created.title,
          scope: created.scope,
          sortOrder: created.sortOrder,
          localityId: created.localityId,
        },
      });
      return created;
    } catch (error) {
      // Clean up on error
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {
        // Ignore cleanup errors
      }
      throwError('VALIDATION_ERROR', {
        field: 'file',
        reason: 'image_processing_failed',
        message:
          'Erro ao processar a imagem. Verifique se o arquivo é uma imagem válida.',
      });
    }
  }

  async updatePhoto(
    id: string,
    payload: {
      title?: string;
      sortOrder?: number;
      localityId?: string | null;
      scope?: string;
    },
    user?: RbacUser,
  ) {
    this.ensureEditorAccess(user, 'update');
    const current = await this.prisma.libraryPhoto.findUnique({
      where: { id },
    });
    if (!current) throwError('NOT_FOUND');
    const nextTitle =
      payload.title === undefined
        ? current.title
        : String(payload.title).trim();
    const nextSortOrder =
      payload.sortOrder === undefined
        ? current.sortOrder
        : Math.max(0, Math.floor(Number(payload.sortOrder) || 0));
    const nextLocalityId =
      payload.localityId === undefined
        ? current.localityId
        : payload.localityId === null || payload.localityId === ''
          ? null
          : String(payload.localityId).trim() || null;
    const nextScope =
      payload.scope === undefined
        ? (current.scope as LibraryScope)
        : this.parseScope(payload.scope);
    await this.assertLocalityForScope(nextLocalityId, nextScope);
    const updated = await this.prisma.libraryPhoto.update({
      where: { id },
      data: {
        title: nextTitle,
        sortOrder: nextSortOrder,
        scope: nextScope,
        localityId: nextLocalityId,
      },
    });
    await this.audit.log({
      userId: user?.id,
      resource: 'library',
      action: 'update_photo',
      entityId: updated.id,
      diffJson: {
        title: updated.title,
        scope: updated.scope,
        sortOrder: updated.sortOrder,
        localityId: updated.localityId,
      },
    });
    return updated;
  }

  async deletePhoto(id: string, _photosDir: string, user?: RbacUser) {
    this.ensureEditorAccess(user, 'delete');
    const current = await this.prisma.libraryPhoto.findUnique({
      where: { id },
    });
    if (!current) throwError('NOT_FOUND');
    await this.prisma.libraryPhoto.delete({ where: { id } });
    // No file cleanup needed since images are stored in DB as base64
    await this.audit.log({
      userId: user?.id,
      resource: 'library',
      action: 'delete_photo',
      entityId: id,
      diffJson: { title: current.title },
    });
    return { success: true };
  }

  async createDocument(
    file: Express.Multer.File,
    payload: { title?: string; scope?: string },
    user?: RbacUser,
  ) {
    this.ensureEditorAccess(user, 'create');
    if (!file) {
      throwError('VALIDATION_ERROR', { field: 'file', reason: 'required' });
    }
    const title =
      String(payload.title ?? '').trim() || file.originalname || 'Documento';
    const scope = this.parseScope(payload.scope);
    const created = await this.prisma.libraryDocument.create({
      data: {
        title,
        scope,
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
      diffJson: {
        title: created.title,
        fileName: created.fileName,
        scope: created.scope,
      },
    });
    return created;
  }

  async updateDocument(
    id: string,
    payload: { title?: string },
    user?: RbacUser,
  ) {
    this.ensureEditorAccess(user, 'update');
    const current = await this.prisma.libraryDocument.findUnique({
      where: { id },
    });
    if (!current) throwError('NOT_FOUND');
    const nextTitle =
      payload.title === undefined
        ? current.title
        : String(payload.title).trim();
    if (!nextTitle) {
      throwError('VALIDATION_ERROR', { field: 'title', reason: 'required' });
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

  async deleteDocument(id: string, documentsDir: string, user?: RbacUser) {
    this.ensureEditorAccess(user, 'delete');
    const current = await this.prisma.libraryDocument.findUnique({
      where: { id },
    });
    if (!current) throwError('NOT_FOUND');
    await this.prisma.libraryDocument.delete({ where: { id } });
    const storageKey = String(current.storageKey ?? '').trim();
    if (storageKey) {
      const filePath =
        resolveExistingLibraryDocumentPath(storageKey) ||
        path.join(documentsDir, storageKey);
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch {
        // The database row was removed; file cleanup can fail silently.
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

  async getDocumentById(id: string) {
    const document = await this.prisma.libraryDocument.findUnique({
      where: { id },
    });
    if (!document) throwError('NOT_FOUND');
    return document;
  }

  private parseScope(value?: string | null): LibraryScope {
    const normalized = String(value ?? '')
      .trim()
      .toUpperCase();
    return normalized === 'CIPAVD' ? 'CIPAVD' : 'SMIF';
  }

  private async assertLocalityForScope(
    localityId: string | null,
    scope: LibraryScope,
  ) {
    if (!localityId) return;
    const locality = await this.prisma.locality.findUnique({
      where: { id: localityId },
      select: { id: true, catalogType: true },
    });
    if (!locality) {
      throwError('VALIDATION_ERROR', {
        field: 'localityId',
        reason: 'invalid',
      });
    }
    const expectedCatalogType =
      scope === 'CIPAVD' ? LocalityCatalogType.CIPAVD : LocalityCatalogType.SMIF;
    if (locality.catalogType !== expectedCatalogType) {
      throwError('VALIDATION_ERROR', {
        field: 'localityId',
        reason: 'scope_mismatch',
      });
    }
  }
}
