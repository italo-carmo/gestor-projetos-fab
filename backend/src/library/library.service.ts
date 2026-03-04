import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AuditService } from '../audit/audit.service';
import { throwError } from '../common/http-error';
import { PrismaService } from '../prisma/prisma.service';
import {
  hasAnyRole,
  ROLE_COORDENACAO_CIPAVD,
  ROLE_TI,
} from '../rbac/role-access';
import type { RbacUser } from '../rbac/rbac.types';

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getData() {
    const [photos, documents, settings] = await this.prisma.$transaction([
      this.prisma.libraryPhoto.findMany({
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
        carouselIntervalSeconds: Number(
          settings?.carouselIntervalSeconds ?? 5,
        ),
      },
    };
  }

  ensureEditorAccess(user?: RbacUser) {
    if (!hasAnyRole(user, [ROLE_TI, ROLE_COORDENACAO_CIPAVD])) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  async updateSettings(
    payload: { carouselIntervalSeconds: number },
    user?: RbacUser,
  ) {
    this.ensureEditorAccess(user);
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
    payload: { title?: string },
    user?: RbacUser,
  ) {
    this.ensureEditorAccess(user);
    if (!file) {
      throwError('VALIDATION_ERROR', { field: 'file', reason: 'required' });
    }
    const currentMaxSortOrder = await this.prisma.libraryPhoto.aggregate({
      _max: { sortOrder: true },
    });
    const nextSortOrder = Number(currentMaxSortOrder._max.sortOrder ?? -1) + 1;
    const title = String(payload.title ?? '').trim() || file.originalname || 'Foto';
    const created = await this.prisma.libraryPhoto.create({
      data: {
        title,
        fileUrl: `/library/uploads/photos/${file.filename}`,
        storageKey: file.filename,
        sortOrder: nextSortOrder,
        createdById: user?.id,
      },
    });
    await this.audit.log({
      userId: user?.id,
      resource: 'library',
      action: 'create_photo',
      entityId: created.id,
      diffJson: { title: created.title, sortOrder: created.sortOrder },
    });
    return created;
  }

  async updatePhoto(
    id: string,
    payload: { title?: string; sortOrder?: number },
    user?: RbacUser,
  ) {
    this.ensureEditorAccess(user);
    const current = await this.prisma.libraryPhoto.findUnique({ where: { id } });
    if (!current) throwError('NOT_FOUND');
    const nextTitle =
      payload.title === undefined ? current.title : String(payload.title).trim();
    if (!nextTitle) {
      throwError('VALIDATION_ERROR', { field: 'title', reason: 'required' });
    }
    const nextSortOrder =
      payload.sortOrder === undefined
        ? current.sortOrder
        : Math.max(0, Math.floor(Number(payload.sortOrder) || 0));
    const updated = await this.prisma.libraryPhoto.update({
      where: { id },
      data: {
        title: nextTitle,
        sortOrder: nextSortOrder,
      },
    });
    await this.audit.log({
      userId: user?.id,
      resource: 'library',
      action: 'update_photo',
      entityId: updated.id,
      diffJson: { title: updated.title, sortOrder: updated.sortOrder },
    });
    return updated;
  }

  async deletePhoto(id: string, photosDir: string, user?: RbacUser) {
    this.ensureEditorAccess(user);
    const current = await this.prisma.libraryPhoto.findUnique({ where: { id } });
    if (!current) throwError('NOT_FOUND');
    await this.prisma.libraryPhoto.delete({ where: { id } });
    const storageKey = String(current.storageKey ?? '').trim();
    if (storageKey) {
      const filePath = path.join(photosDir, storageKey);
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch {
        // The database row was removed; file cleanup can fail silently.
      }
    }
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
    payload: { title?: string },
    user?: RbacUser,
  ) {
    this.ensureEditorAccess(user);
    if (!file) {
      throwError('VALIDATION_ERROR', { field: 'file', reason: 'required' });
    }
    const title =
      String(payload.title ?? '').trim() || file.originalname || 'Documento';
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

  async updateDocument(id: string, payload: { title?: string }, user?: RbacUser) {
    this.ensureEditorAccess(user);
    const current = await this.prisma.libraryDocument.findUnique({ where: { id } });
    if (!current) throwError('NOT_FOUND');
    const nextTitle =
      payload.title === undefined ? current.title : String(payload.title).trim();
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
    this.ensureEditorAccess(user);
    const current = await this.prisma.libraryDocument.findUnique({ where: { id } });
    if (!current) throwError('NOT_FOUND');
    await this.prisma.libraryDocument.delete({ where: { id } });
    const storageKey = String(current.storageKey ?? '').trim();
    if (storageKey) {
      const filePath = path.join(documentsDir, storageKey);
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
}

