import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import * as path from 'node:path';
import { AuditService } from '../audit/audit.service';
import { throwError } from '../common/http-error';
import { PrismaService } from '../prisma/prisma.service';
import type { RbacUser } from '../rbac/rbac.types';
import {
  hasAnyRole,
  ROLE_COMGEP,
  ROLE_TI,
} from '../rbac/role-access';
import { resolveExistingCipavdReportPath } from './cipavd-reports-storage';

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx']);
const ALLOWED_MIME_TYPES = new Set([
  '',
  'application/octet-stream',
  'application/pdf',
  'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/x-zip-compressed',
]);

type FolderOption = {
  id: string | null;
  name: string;
  path: string;
  depth: number;
};

@Injectable()
export class CipavdReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listFolder(
    filters: { folderId?: string | null; q?: string | null },
    user?: RbacUser,
  ) {
    this.assertAccess(user);
    const folderId = this.normalizeNullableId(filters.folderId);
    const q = String(filters.q ?? '').trim();
    const folder = folderId
      ? await this.prisma.cipavdReportFolder.findUnique({
          where: { id: folderId },
          include: { createdBy: this.createdBySelect() },
        })
      : null;
    if (folderId && !folder) throwError('NOT_FOUND');

    const nameFilter = q
      ? { contains: q, mode: 'insensitive' as const }
      : undefined;
    const [folders, files, breadcrumbs] = await Promise.all([
      this.prisma.cipavdReportFolder.findMany({
        where: {
          parentId: folderId,
          ...(nameFilter ? { name: nameFilter } : {}),
        },
        include: {
          createdBy: this.createdBySelect(),
          _count: { select: { children: true, files: true } },
        },
        orderBy: [{ name: 'asc' }],
      }),
      this.prisma.cipavdReportFile.findMany({
        where: {
          folderId,
          ...(nameFilter ? { name: nameFilter } : {}),
        },
        include: { createdBy: this.createdBySelect() },
        orderBy: [{ name: 'asc' }],
      }),
      this.getBreadcrumbs(folderId),
    ]);

    return {
      currentFolder: folder ? this.serializeFolder(folder) : null,
      breadcrumbs,
      folders: folders.map((item) => this.serializeFolder(item)),
      files: files.map((item) => this.serializeFile(item)),
    };
  }

  async listFolderOptions(
    filters: { excludeFolderId?: string | null },
    user?: RbacUser,
  ) {
    this.assertAccess(user);
    const excludeFolderId = this.normalizeNullableId(filters.excludeFolderId);
    const [folders, excludedIds] = await Promise.all([
      this.prisma.cipavdReportFolder.findMany({
        select: { id: true, name: true, parentId: true },
        orderBy: [{ name: 'asc' }],
      }),
      excludeFolderId
        ? this.listDescendantFolderIds(excludeFolderId, { includeSelf: true })
        : Promise.resolve([]),
    ]);
    const excluded = new Set(excludedIds);
    const folderMap = new Map(folders.map((item) => [item.id, item]));
    const options: FolderOption[] = [
      { id: null, name: 'Relatórios', path: 'Relatórios', depth: 0 },
    ];

    for (const folder of folders) {
      if (excluded.has(folder.id)) continue;
      const pathParts = this.buildFolderPathParts(folder.id, folderMap);
      options.push({
        id: folder.id,
        name: folder.name,
        path: ['Relatórios', ...pathParts].join(' / '),
        depth: pathParts.length,
      });
    }

    return {
      items: options.sort((a, b) => a.path.localeCompare(b.path, 'pt-BR')),
    };
  }

  async listKnowledgeBaseCandidates(
    filters: { q?: string | null },
    user?: RbacUser,
  ) {
    this.assertAccess(user);
    const q = String(filters.q ?? '').trim();
    const [files, folders] = await Promise.all([
      this.prisma.cipavdReportFile.findMany({
        where: q
          ? { name: { contains: q, mode: 'insensitive' as const } }
          : undefined,
        include: { createdBy: this.createdBySelect() },
        orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
        take: 250,
      }),
      this.prisma.cipavdReportFolder.findMany({
        select: { id: true, name: true, parentId: true },
      }),
    ]);
    const folderMap = new Map(folders.map((item) => [item.id, item]));
    return {
      items: files.map((file) => ({
        ...this.serializeFile(file),
        path: this.buildFilePath(file.folderId, file.name, folderMap),
        folderPath: this.buildFolderPath(file.folderId, folderMap),
      })),
    };
  }

  async createFolder(
    payload: { name?: string | null; parentId?: string | null },
    user?: RbacUser,
  ) {
    this.assertAccess(user);
    const name = this.normalizeFolderName(payload.name);
    const parentId = this.normalizeNullableId(payload.parentId);
    await this.assertParentFolderExists(parentId);
    await this.assertFolderNameAvailable(parentId, name);

    const created = await this.prisma.cipavdReportFolder.create({
      data: {
        name,
        parentId,
        createdById: user?.id ?? null,
      },
      include: {
        createdBy: this.createdBySelect(),
        _count: { select: { children: true, files: true } },
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'cipavd_reports',
      action: 'create_folder',
      entityId: created.id,
      diffJson: { name, parentId },
    });

    return this.serializeFolder(created);
  }

  async updateFolder(
    id: string,
    payload: { name?: string | null; parentId?: string | null },
    user?: RbacUser,
  ) {
    this.assertAccess(user);
    const current = await this.prisma.cipavdReportFolder.findUnique({
      where: { id },
    });
    if (!current) throwError('NOT_FOUND');

    const nextName =
      payload.name === undefined
        ? current.name
        : this.normalizeFolderName(payload.name);
    const nextParentId =
      payload.parentId === undefined
        ? current.parentId
        : this.normalizeNullableId(payload.parentId);

    if (nextParentId === current.id) {
      throwError('VALIDATION_ERROR', {
        field: 'parentId',
        reason: 'self_parent',
      });
    }
    await this.assertParentFolderExists(nextParentId);
    if (nextParentId && (await this.isFolderInside(nextParentId, current.id))) {
      throwError('VALIDATION_ERROR', {
        field: 'parentId',
        reason: 'descendant_parent',
      });
    }
    await this.assertFolderNameAvailable(nextParentId, nextName, current.id);

    const updated = await this.prisma.cipavdReportFolder.update({
      where: { id },
      data: { name: nextName, parentId: nextParentId },
      include: {
        createdBy: this.createdBySelect(),
        _count: { select: { children: true, files: true } },
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'cipavd_reports',
      action: 'update_folder',
      entityId: updated.id,
      diffJson: {
        before: { name: current.name, parentId: current.parentId },
        after: { name: updated.name, parentId: updated.parentId },
      },
    });

    return this.serializeFolder(updated);
  }

  async deleteFolder(id: string, user?: RbacUser) {
    this.assertAccess(user);
    const current = await this.prisma.cipavdReportFolder.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!current) throwError('NOT_FOUND');

    const folderIds = await this.listDescendantFolderIds(id, {
      includeSelf: true,
    });
    const files = await this.prisma.cipavdReportFile.findMany({
      where: { folderId: { in: folderIds } },
      select: { id: true, storageKey: true },
    });

    await this.prisma.cipavdReportFolder.delete({ where: { id } });
    await Promise.all(files.map((file) => this.removeStoredFile(file.storageKey)));

    await this.audit.log({
      userId: user?.id,
      resource: 'cipavd_reports',
      action: 'delete_folder',
      entityId: id,
      diffJson: {
        name: current.name,
        deletedFolders: folderIds.length,
        deletedFiles: files.length,
      },
    });

    return { ok: true };
  }

  async uploadFile(
    file: Express.Multer.File | undefined,
    payload: { name?: string | null; folderId?: string | null },
    user?: RbacUser,
  ) {
    this.assertAccess(user);
    if (!file) {
      throwError('VALIDATION_ERROR', {
        field: 'file',
        reason: 'pdf_or_docx_required',
      });
    }

    try {
      const folderId = this.normalizeNullableId(payload.folderId);
      await this.assertParentFolderExists(folderId);
      const name = this.normalizeFileName(payload.name, file.originalname);
      this.assertSupportedFile(file, name);
      await this.assertFileNameAvailable(folderId, name);

      const checksum = await this.computeFileChecksum(file.path);
      const created = await this.prisma.cipavdReportFile.create({
        data: {
          name,
          folderId,
          fileName: file.originalname || name,
          fileUrl: '/cipavd-reports/files/pending/download',
          storageKey: file.filename,
          mimeType: file.mimetype || this.detectMimeType(name),
          fileSize: Number.isFinite(file.size) ? file.size : null,
          checksum,
          createdById: user?.id ?? null,
        },
        include: { createdBy: this.createdBySelect() },
      });
      const updated = await this.prisma.cipavdReportFile.update({
        where: { id: created.id },
        data: { fileUrl: this.buildDownloadUrl(created.id) },
        include: { createdBy: this.createdBySelect() },
      });

      await this.audit.log({
        userId: user?.id,
        resource: 'cipavd_reports',
        action: 'upload_file',
        entityId: updated.id,
        diffJson: {
          name,
          folderId,
          fileName: updated.fileName,
          checksum,
          fileSize: updated.fileSize,
        },
      });

      return this.serializeFile(updated);
    } catch (error) {
      await this.removeUploadedFile(file);
      throw error;
    }
  }

  async updateFile(
    id: string,
    payload: { name?: string | null; folderId?: string | null },
    user?: RbacUser,
  ) {
    this.assertAccess(user);
    const current = await this.prisma.cipavdReportFile.findUnique({
      where: { id },
    });
    if (!current) throwError('NOT_FOUND');

    const nextName =
      payload.name === undefined
        ? current.name
        : this.normalizeFileName(payload.name, current.fileName);
    this.assertSupportedExtension(nextName);
    const nextFolderId =
      payload.folderId === undefined
        ? current.folderId
        : this.normalizeNullableId(payload.folderId);
    await this.assertParentFolderExists(nextFolderId);
    await this.assertFileNameAvailable(nextFolderId, nextName, current.id);

    const updated = await this.prisma.cipavdReportFile.update({
      where: { id },
      data: { name: nextName, folderId: nextFolderId },
      include: { createdBy: this.createdBySelect() },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'cipavd_reports',
      action: 'update_file',
      entityId: updated.id,
      diffJson: {
        before: { name: current.name, folderId: current.folderId },
        after: { name: updated.name, folderId: updated.folderId },
      },
    });

    return this.serializeFile(updated);
  }

  async deleteFile(id: string, user?: RbacUser) {
    this.assertAccess(user);
    const current = await this.prisma.cipavdReportFile.findUnique({
      where: { id },
    });
    if (!current) throwError('NOT_FOUND');

    await this.prisma.cipavdReportFile.delete({ where: { id } });
    await this.removeStoredFile(current.storageKey);

    await this.audit.log({
      userId: user?.id,
      resource: 'cipavd_reports',
      action: 'delete_file',
      entityId: id,
      diffJson: {
        name: current.name,
        fileName: current.fileName,
        folderId: current.folderId,
      },
    });

    return { ok: true };
  }

  async getFileForDownload(id: string, user?: RbacUser) {
    this.assertAccess(user);
    const file = await this.prisma.cipavdReportFile.findUnique({
      where: { id },
    });
    if (!file) throwError('NOT_FOUND');
    const filePath = resolveExistingCipavdReportPath(file.storageKey);
    if (!filePath) throwError('NOT_FOUND');
    return { ...file, filePath };
  }

  async getFileForKnowledgeBaseImport(id: string, user?: RbacUser) {
    this.assertAccess(user);
    const [file, folders] = await Promise.all([
      this.getFileForDownload(id, user),
      this.prisma.cipavdReportFolder.findMany({
        select: { id: true, name: true, parentId: true },
      }),
    ]);
    const folderMap = new Map(folders.map((item) => [item.id, item]));
    return {
      ...file,
      path: this.buildFilePath(file.folderId, file.name, folderMap),
      folderPath: this.buildFolderPath(file.folderId, folderMap),
    };
  }

  assertAccess(user: RbacUser | undefined) {
    if (!hasAnyRole(user, [ROLE_COMGEP, ROLE_TI])) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private createdBySelect() {
    return {
      select: {
        id: true,
        name: true,
        email: true,
      },
    } as const;
  }

  private serializeFolder(folder: any) {
    return {
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId ?? null,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
      createdBy: folder.createdBy ?? null,
      folderCount: folder._count?.children ?? 0,
      fileCount: folder._count?.files ?? 0,
    };
  }

  private serializeFile(file: any) {
    return {
      id: file.id,
      name: file.name,
      folderId: file.folderId ?? null,
      fileName: file.fileName,
      fileUrl: file.fileUrl || this.buildDownloadUrl(file.id),
      storageKey: file.storageKey,
      mimeType: file.mimeType ?? null,
      fileSize: file.fileSize ?? null,
      checksum: file.checksum ?? null,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
      createdBy: file.createdBy ?? null,
      downloadUrl: this.buildDownloadUrl(file.id),
    };
  }

  private normalizeNullableId(value: string | null | undefined) {
    const normalized = String(value ?? '').trim();
    return normalized || null;
  }

  private normalizeFolderName(value: string | null | undefined) {
    const name = String(value ?? '').replace(/\s+/g, ' ').trim();
    if (!name) {
      throwError('VALIDATION_ERROR', { field: 'name', reason: 'required' });
    }
    if (name === '.' || name === '..' || /[\\/]/.test(name)) {
      throwError('VALIDATION_ERROR', { field: 'name', reason: 'invalid' });
    }
    if (name.length > 120) {
      throwError('VALIDATION_ERROR', { field: 'name', reason: 'too_long' });
    }
    return name;
  }

  private normalizeFileName(
    value: string | null | undefined,
    originalName?: string | null,
  ) {
    const originalExtension = path
      .extname(String(originalName ?? ''))
      .toLowerCase();
    const raw = String(value ?? '').trim() || String(originalName ?? '').trim();
    let name = raw.replace(/[\\/]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!name) {
      throwError('VALIDATION_ERROR', { field: 'name', reason: 'required' });
    }
    if (!path.extname(name) && originalExtension) {
      name = `${name}${originalExtension}`;
    }
    this.assertSupportedExtension(name);
    if (name.length > 180) {
      const extension = path.extname(name);
      const base = name.slice(0, 180 - extension.length).trim();
      name = `${base}${extension}`;
    }
    return name;
  }

  private assertSupportedFile(file: Express.Multer.File, name: string) {
    this.assertSupportedExtension(name);
    const mimetype = String(file.mimetype ?? '').trim().toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(mimetype)) {
      throwError('VALIDATION_ERROR', {
        field: 'file',
        reason: 'pdf_or_docx_required',
      });
    }
  }

  private assertSupportedExtension(name: string) {
    const extension = path.extname(String(name ?? '')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throwError('VALIDATION_ERROR', {
        field: 'file',
        reason: 'pdf_or_docx_required',
      });
    }
  }

  private async assertParentFolderExists(parentId: string | null) {
    if (!parentId) return;
    const parent = await this.prisma.cipavdReportFolder.findUnique({
      where: { id: parentId },
      select: { id: true },
    });
    if (!parent) {
      throwError('VALIDATION_ERROR', { field: 'parentId', reason: 'invalid' });
    }
  }

  private async assertFolderNameAvailable(
    parentId: string | null,
    name: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.cipavdReportFolder.findFirst({
      where: {
        parentId,
        name,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throwError('CONFLICT_UNIQUE', { field: 'name' });
    }
  }

  private async assertFileNameAvailable(
    folderId: string | null,
    name: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.cipavdReportFile.findFirst({
      where: {
        folderId,
        name,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throwError('CONFLICT_UNIQUE', { field: 'name' });
    }
  }

  private async isFolderInside(candidateFolderId: string, folderId: string) {
    let cursor: string | null = candidateFolderId;
    for (let depth = 0; cursor && depth < 80; depth += 1) {
      if (cursor === folderId) return true;
      const parent: { parentId: string | null } | null =
        await this.prisma.cipavdReportFolder.findUnique({
          where: { id: cursor },
          select: { parentId: true },
        });
      cursor = parent?.parentId ?? null;
    }
    return false;
  }

  private async listDescendantFolderIds(
    folderId: string,
    options?: { includeSelf?: boolean },
  ) {
    const current = await this.prisma.cipavdReportFolder.findUnique({
      where: { id: folderId },
      select: { id: true },
    });
    if (!current) throwError('NOT_FOUND');

    const ids = options?.includeSelf ? [folderId] : [];
    let frontier = [folderId];
    for (let depth = 0; frontier.length && depth < 80; depth += 1) {
      const children = await this.prisma.cipavdReportFolder.findMany({
        where: { parentId: { in: frontier } },
        select: { id: true },
      });
      frontier = children.map((item) => item.id);
      ids.push(...frontier);
    }
    return ids;
  }

  private async getBreadcrumbs(folderId: string | null) {
    const chain: Array<{ id: string; name: string }> = [];
    let cursor = folderId;
    for (let depth = 0; cursor && depth < 80; depth += 1) {
      const folder = await this.prisma.cipavdReportFolder.findUnique({
        where: { id: cursor },
        select: { id: true, name: true, parentId: true },
      });
      if (!folder) throwError('NOT_FOUND');
      chain.push({ id: folder.id, name: folder.name });
      cursor = folder.parentId;
    }
    return [{ id: null, name: 'Relatórios' }, ...chain.reverse()];
  }

  private buildFolderPathParts(
    folderId: string | null,
    folderMap: Map<string, { id: string; name: string; parentId: string | null }>,
  ) {
    const parts: string[] = [];
    let cursor = folderId;
    for (let depth = 0; cursor && depth < 80; depth += 1) {
      const folder = folderMap.get(cursor);
      if (!folder) break;
      parts.unshift(folder.name);
      cursor = folder.parentId;
    }
    return parts;
  }

  private buildFolderPath(
    folderId: string | null,
    folderMap: Map<string, { id: string; name: string; parentId: string | null }>,
  ) {
    return ['Relatórios', ...this.buildFolderPathParts(folderId, folderMap)].join(
      ' / ',
    );
  }

  private buildFilePath(
    folderId: string | null,
    fileName: string,
    folderMap: Map<string, { id: string; name: string; parentId: string | null }>,
  ) {
    return [this.buildFolderPath(folderId, folderMap), fileName].join(' / ');
  }

  private buildDownloadUrl(id: string) {
    return `/cipavd-reports/files/${encodeURIComponent(id)}/download`;
  }

  private detectMimeType(name: string) {
    const extension = path.extname(name).toLowerCase();
    if (extension === '.pdf') return 'application/pdf';
    if (extension === '.docx') {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    return null;
  }

  private async computeFileChecksum(filePath: string) {
    const buffer = await readFile(filePath);
    return createHash('sha256').update(buffer).digest('hex');
  }

  private async removeUploadedFile(file: Express.Multer.File | undefined) {
    const filePath = String(file?.path ?? '').trim();
    if (!filePath) return;
    await rm(filePath, { force: true }).catch(() => undefined);
  }

  private async removeStoredFile(storageKey: string | null | undefined) {
    const filePath = resolveExistingCipavdReportPath(storageKey ?? '');
    if (!filePath) return;
    await rm(filePath, { force: true }).catch(() => undefined);
  }
}
