import { Injectable } from '@nestjs/common';
import { TiptapTransformer } from '@hocuspocus/transformer';
import {
  DocumentAssetType,
  DocumentCategory,
  DocumentLinkEntity,
  DocumentParseStatus,
  PermissionScope,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import * as Y from 'yjs';
import { PrismaService } from '../prisma/prisma.service';
import { throwError } from '../common/http-error';
import type { RbacUser } from '../rbac/rbac.types';
import { parsePagination } from '../common/pagination';
import { AuditService } from '../audit/audit.service';
import { CreateDocumentSubcategoryDto } from './dto/create-document-subcategory.dto';
import { UpdateDocumentSubcategoryDto } from './dto/update-document-subcategory.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { CreateOnlineDocumentDto } from './dto/create-online-document.dto';
import { UpdateOnlineDocumentContentDto } from './dto/update-online-document-content.dto';
import { UpdateOnlineDocumentPresenceDto } from './dto/update-online-document-presence.dto';
import {
  hasAnyRole,
  hasPermission,
  ROLE_COMGEP,
  ROLE_TI,
} from '../rbac/role-access';
import { documentEditorExtensions } from './document-editor.extensions';

const INITIAL_ONLINE_DOCUMENT_CONTENT = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

const DEFAULT_ONLINE_DOCUMENT_PAGE_SETTINGS = {
  marginTopCm: 2.5,
  marginRightCm: 2.5,
  marginBottomCm: 2.5,
  marginLeftCm: 2.5,
};

const ONLINE_DOCUMENT_MIME_TYPE = 'application/vnd.gestor.online-document+json';
const ONLINE_DOCUMENT_PRESENCE_TTL_MS = 30_000;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    filters: {
      q?: string;
      category?: string;
      subcategoryId?: string;
      localityId?: string;
      page?: string;
      pageSize?: string;
    },
    user?: RbacUser,
  ) {
    const where: Prisma.DocumentAssetWhereInput = { deletedAt: null };

    if (filters.q) {
      where.OR = [
        { title: { contains: filters.q, mode: 'insensitive' } },
        { sourcePath: { contains: filters.q, mode: 'insensitive' } },
        { subcategory: { name: { contains: filters.q, mode: 'insensitive' } } },
      ];
    }

    if (filters.category) {
      where.category = filters.category as DocumentCategory;
    }

    if (filters.subcategoryId) {
      where.subcategoryId = filters.subcategoryId;
    }

    if (filters.localityId) {
      where.localityId = filters.localityId;
    }

    if (this.shouldApplyLocalityScope(user)) {
      const scopedLocalityId = user?.localityId as string;
      const andArr = Array.isArray(where.AND)
        ? where.AND
        : where.AND
          ? [where.AND]
          : [];
      where.AND = [
        ...andArr,
        { OR: [{ localityId: null }, { localityId: scopedLocalityId }] },
      ];
    }

    const { page, pageSize, skip, take } = parsePagination(
      filters.page,
      filters.pageSize,
    );

    const [items, total] = await this.prisma.$transaction([
      this.prisma.documentAsset.findMany({
        where,
        include: this.documentInclude(),
        orderBy: [{ createdAt: 'desc' }, { title: 'asc' }],
        skip,
        take,
      }),
      this.prisma.documentAsset.count({ where }),
    ]);

    return {
      items: items.map((item) => this.mapDocumentWithAccess(item, user)),
      page,
      pageSize,
      total,
    };
  }

  async listSubcategories(filters: { category?: string }, user?: RbacUser) {
    const where: Prisma.DocumentSubcategoryWhereInput = {};
    if (filters.category) where.category = filters.category as DocumentCategory;

    const whereDocScope: Prisma.DocumentAssetWhereInput =
      this.documentScopeWhere(user);
    if (filters.category)
      whereDocScope.category = filters.category as DocumentCategory;

    const [subcategories, scopedDocuments] = await this.prisma.$transaction([
      this.prisma.documentSubcategory.findMany({
        where,
        orderBy: [{ category: 'asc' }, { parentId: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.documentAsset.findMany({
        where: {
          ...whereDocScope,
          subcategoryId: { not: null },
        },
        select: { subcategoryId: true },
      }),
    ]);

    const countBySubcategoryId = new Map<string, number>();
    for (const row of scopedDocuments) {
      if (!row.subcategoryId) continue;
      countBySubcategoryId.set(
        row.subcategoryId,
        (countBySubcategoryId.get(row.subcategoryId) ?? 0) + 1,
      );
    }

    const byId = new Map(subcategories.map((item) => [item.id, item]));
    const childrenByParentId = new Map<
      string | null,
      Array<(typeof subcategories)[number]>
    >();
    for (const subcategory of subcategories) {
      const parentKey = subcategory.parentId ?? null;
      const children = childrenByParentId.get(parentKey) ?? [];
      children.push(subcategory);
      childrenByParentId.set(parentKey, children);
    }

    const sortedChildren = (parentId: string | null) =>
      [...(childrenByParentId.get(parentId) ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name),
      );

    const pathCache = new Map<string, string>();
    const getPath = (id: string): string => {
      const cached = pathCache.get(id);
      if (cached) return cached;
      const node = byId.get(id);
      if (!node) return '';
      if (!node.parentId || !byId.has(node.parentId)) {
        pathCache.set(id, node.name);
        return node.name;
      }
      const parentPath = getPath(node.parentId);
      const path = parentPath ? `${parentPath}/${node.name}` : node.name;
      pathCache.set(id, path);
      return path;
    };

    const enrichedMap = new Map(
      subcategories.map((subcategory) => [
        subcategory.id,
        {
          ...subcategory,
          fullPath: getPath(subcategory.id),
          depth: getPath(subcategory.id).split('/').length - 1,
          documentCount: countBySubcategoryId.get(subcategory.id) ?? 0,
        },
      ]),
    );

    const buildTree = (parentId: string | null): any[] =>
      sortedChildren(parentId).map((node) => {
        const children = buildTree(node.id);
        const current = enrichedMap.get(node.id);
        const directCount = current?.documentCount ?? 0;
        const totalDocumentCount =
          directCount +
          children.reduce(
            (sum, child) => sum + (child.totalDocumentCount ?? 0),
            0,
          );
        return {
          ...current,
          children,
          totalDocumentCount,
        };
      });

    const tree = buildTree(null);

    return {
      items: Array.from(enrichedMap.values()).sort((a, b) =>
        a.fullPath.localeCompare(b.fullPath),
      ),
      tree,
    };
  }

  async createSubcategory(
    payload: CreateDocumentSubcategoryDto,
    user?: RbacUser,
  ) {
    const category = payload.category;
    const name = payload.name?.trim();
    const normalizedParentId =
      payload.parentId === undefined ||
      payload.parentId === null ||
      payload.parentId === ''
        ? null
        : payload.parentId.trim();

    if (!name) {
      throwError('VALIDATION_ERROR', { field: 'name', reason: 'required' });
    }

    if (normalizedParentId) {
      const parent = await this.prisma.documentSubcategory.findUnique({
        where: { id: normalizedParentId },
        select: { id: true, category: true },
      });
      if (!parent) throwError('NOT_FOUND');
      if (parent.category !== category) {
        throwError('VALIDATION_ERROR', {
          field: 'parentId',
          reason: 'parent_category_mismatch',
          expectedCategory: category,
        });
      }
    }

    const existing = await this.prisma.documentSubcategory.findFirst({
      where: {
        category,
        parentId: normalizedParentId,
        name: { equals: name, mode: 'insensitive' },
      },
    });
    if (existing) {
      throwError('CONFLICT_UNIQUE', {
        field: 'name',
        category,
        parentId: normalizedParentId,
      });
    }

    const created = await this.prisma.documentSubcategory.create({
      data: {
        category,
        name,
        parentId: normalizedParentId,
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'documents',
      action: 'create_subcategory',
      entityId: created.id,
      diffJson: {
        category: created.category,
        name: created.name,
        parentId: created.parentId,
      },
    });

    return {
      ...created,
      documentCount: 0,
      totalDocumentCount: 0,
    };
  }

  async updateSubcategory(
    id: string,
    payload: UpdateDocumentSubcategoryDto,
    user?: RbacUser,
  ) {
    const current = await this.prisma.documentSubcategory.findUnique({
      where: { id },
      select: { id: true, category: true, name: true, parentId: true },
    });
    if (!current) throwError('NOT_FOUND');

    const nextName =
      payload.name === undefined ? current.name : payload.name.trim();
    const nextParentId =
      payload.parentId === undefined
        ? current.parentId
        : payload.parentId === null || payload.parentId === ''
          ? null
          : payload.parentId.trim();

    if (!nextName) {
      throwError('VALIDATION_ERROR', { field: 'name', reason: 'required' });
    }
    if (nextParentId === id) {
      throwError('VALIDATION_ERROR', {
        field: 'parentId',
        reason: 'self_parent',
      });
    }

    if (nextParentId) {
      const parent = await this.prisma.documentSubcategory.findUnique({
        where: { id: nextParentId },
        select: { id: true, category: true, parentId: true },
      });
      if (!parent) throwError('NOT_FOUND');
      if (parent.category !== current.category) {
        throwError('VALIDATION_ERROR', {
          field: 'parentId',
          reason: 'parent_category_mismatch',
          expectedCategory: current.category,
        });
      }
      await this.assertNoSubcategoryCycle(id, nextParentId);
    }

    const sibling = await this.prisma.documentSubcategory.findFirst({
      where: {
        id: { not: id },
        category: current.category,
        parentId: nextParentId,
        name: { equals: nextName, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (sibling) {
      throwError('CONFLICT_UNIQUE', {
        field: 'name',
        category: current.category,
        parentId: nextParentId,
      });
    }

    const updated = await this.prisma.documentSubcategory.update({
      where: { id },
      data: {
        name: nextName,
        parentId: nextParentId,
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'documents',
      action: 'update_subcategory',
      entityId: id,
      diffJson: {
        name: updated.name,
        parentId: updated.parentId,
      },
    });

    return updated;
  }

  async deleteSubcategory(id: string, user?: RbacUser) {
    const current = await this.prisma.documentSubcategory.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!current) throwError('NOT_FOUND');

    const ids = await this.collectSubcategorySubtreeIds(id);
    const [unlinked, deleted] = await this.prisma.$transaction([
      this.prisma.documentAsset.updateMany({
        where: { subcategoryId: { in: ids } },
        data: { subcategoryId: null },
      }),
      this.prisma.documentSubcategory.deleteMany({
        where: { id: { in: ids } },
      }),
    ]);

    await this.audit.log({
      userId: user?.id,
      resource: 'documents',
      action: 'delete_subcategory',
      entityId: id,
      diffJson: {
        deletedFolders: deleted.count,
        unlinkedDocuments: unlinked.count,
      },
    });

    return {
      deletedFolders: deleted.count,
      unlinkedDocuments: unlinked.count,
    };
  }

  async createOnlineDocument(
    payload: CreateOnlineDocumentDto,
    user?: RbacUser,
  ) {
    const title = payload.title?.trim();
    if (!title) {
      throwError('VALIDATION_ERROR', { field: 'title', reason: 'required' });
    }

    const normalizedLocalityId =
      payload.localityId === undefined ||
      payload.localityId === null ||
      payload.localityId === ''
        ? null
        : payload.localityId;

    if (normalizedLocalityId) {
      const locality = await this.prisma.locality.findUnique({
        where: { id: normalizedLocalityId },
        select: { id: true },
      });
      if (!locality) throwError('NOT_FOUND');
    }

    if (
      this.shouldApplyLocalityScope(user) &&
      normalizedLocalityId &&
      normalizedLocalityId !== user?.localityId
    ) {
      throwError('RBAC_FORBIDDEN');
    }

    const normalizedSubcategoryId =
      payload.subcategoryId === undefined ||
      payload.subcategoryId === null ||
      payload.subcategoryId === ''
        ? null
        : payload.subcategoryId.trim();

    if (normalizedSubcategoryId) {
      const subcategory = await this.prisma.documentSubcategory.findUnique({
        where: { id: normalizedSubcategoryId },
        select: { id: true, category: true },
      });
      if (!subcategory) throwError('NOT_FOUND');
      if (subcategory.category !== payload.category) {
        throwError('VALIDATION_ERROR', {
          field: 'subcategoryId',
          reason: 'subcategory_category_mismatch',
          expectedCategory: payload.category,
        });
      }
    }

    const id = randomUUID();
    const sourcePath =
      payload.sourcePath?.trim() ||
      this.buildOnlineDocumentSourcePath(payload.category, title);
    const fileName = `${this.sanitizeOnlineDocumentFileBase(title)}.docx`;
    const contentJson =
      INITIAL_ONLINE_DOCUMENT_CONTENT as Prisma.InputJsonValue;
    const pageSettingsJson =
      DEFAULT_ONLINE_DOCUMENT_PAGE_SETTINGS as Prisma.InputJsonValue;

    const created = await this.prisma.$transaction(async (tx) => {
      const document = await tx.documentAsset.create({
        data: {
          id,
          title,
          assetType: DocumentAssetType.ONLINE_DOC,
          category: payload.category,
          subcategoryId: normalizedSubcategoryId,
          sourcePath,
          fileName,
          fileUrl: `/documents/editor/${encodeURIComponent(id)}`,
          mimeType: ONLINE_DOCUMENT_MIME_TYPE,
          localityId: normalizedLocalityId,
          tagsJson: {
            kind: 'online_document',
            createdById: user?.id ?? null,
            createdByEmail: user?.email ?? null,
          },
          content: {
            create: {
              parseStatus: DocumentParseStatus.EXTRACTED,
              textContent: '',
              parsedAt: new Date(),
              metadataJson: { source: 'online_document' },
            },
          },
          onlineContent: {
            create: {
              contentJson,
              plainText: '',
              pageSettingsJson,
              savedRevision: 1,
              lastSavedById: user?.id,
            },
          },
          onlineVersions: {
            create: {
              revision: 1,
              title: 'Criacao do documento',
              contentJson,
              plainText: '',
              pageSettingsJson,
              createdById: user?.id,
            },
          },
        },
        include: this.documentInclude(),
      });
      return document;
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'documents',
      action: 'create_online_document',
      entityId: created.id,
      localityId: created.localityId ?? undefined,
      diffJson: {
        title: created.title,
        category: created.category,
        subcategoryId: created.subcategoryId ?? null,
      },
    });

    return this.mapDocumentWithAccess(created, user);
  }

  async getOnlineDocument(id: string, user?: RbacUser) {
    const document = await this.prisma.documentAsset.findUnique({
      where: { id },
      include: {
        ...this.documentInclude(),
        onlineContent: true,
      },
    });
    if (!document) throwError('NOT_FOUND');
    this.assertDocumentNotDeleted(document);
    this.assertOnlineDocument(document);
    this.assertOnlineDocumentPermission(document, user, 'view');
    this.assertDocumentScope(document, user);

    return {
      document: this.mapDocumentWithAccess(document, user),
      content: document.onlineContent ?? {
        contentJson: INITIAL_ONLINE_DOCUMENT_CONTENT,
        plainText: '',
        pageSettingsJson: DEFAULT_ONLINE_DOCUMENT_PAGE_SETTINGS,
        savedRevision: 0,
        updatedAt: document.updatedAt,
      },
    };
  }

  async saveOnlineDocument(
    id: string,
    payload: UpdateOnlineDocumentContentDto,
    user?: RbacUser,
  ) {
    const document = await this.prisma.documentAsset.findUnique({
      where: { id },
      include: {
        ...this.documentInclude(),
        onlineContent: true,
      },
    });
    if (!document) throwError('NOT_FOUND');
    this.assertDocumentNotDeleted(document);
    this.assertOnlineDocument(document);
    this.assertOnlineDocumentPermission(document, user, 'update');
    this.assertDocumentScope(document, user);
    if (!this.canEdit(document, user)) {
      throwError('RBAC_FORBIDDEN');
    }

    const contentJson = payload.contentJson as Prisma.InputJsonValue;
    const plainText = String(payload.plainText ?? '').slice(0, 500_000);
    const pageSettingsJson = payload.pageSettingsJson
      ? (payload.pageSettingsJson as Prisma.InputJsonValue)
      : (DEFAULT_ONLINE_DOCUMENT_PAGE_SETTINGS as Prisma.InputJsonValue);
    const nextRevision = (document.onlineContent?.savedRevision ?? 0) + 1;
    const versionTitle = payload.versionTitle?.trim();
    const shouldCreateVersion =
      nextRevision === 1 || nextRevision % 10 === 0 || Boolean(versionTitle);
    const ydocState = this.encodeOnlineDocumentYDocState(contentJson);

    const saved = await this.prisma.$transaction(async (tx) => {
      const onlineContent = await tx.documentOnlineContent.upsert({
        where: { documentId: id },
        create: {
          documentId: id,
          contentJson,
          plainText,
          pageSettingsJson,
          ydocState,
          ydocStateUpdatedAt: new Date(),
          savedRevision: nextRevision,
          lastSavedById: user?.id,
        },
        update: {
          contentJson,
          plainText,
          pageSettingsJson,
          ydocState,
          ydocStateUpdatedAt: new Date(),
          savedRevision: nextRevision,
          lastSavedById: user?.id,
        },
      });

      await tx.documentContent.upsert({
        where: { documentId: id },
        create: {
          documentId: id,
          parseStatus: DocumentParseStatus.EXTRACTED,
          textContent: plainText,
          parsedAt: new Date(),
          metadataJson: { source: 'online_document' },
        },
        update: {
          parseStatus: DocumentParseStatus.EXTRACTED,
          textContent: plainText,
          parsedAt: new Date(),
          metadataJson: { source: 'online_document' },
        },
      });

      await tx.documentAsset.update({
        where: { id },
        data: { updatedAt: new Date() },
      });

      if (shouldCreateVersion) {
        await tx.documentOnlineVersion.upsert({
          where: {
            documentId_revision: {
              documentId: id,
              revision: nextRevision,
            },
          },
          create: {
            documentId: id,
            revision: nextRevision,
            title: versionTitle || `Salvamento ${nextRevision}`,
            contentJson,
            plainText,
            pageSettingsJson,
            createdById: user?.id,
          },
          update: {
            title: versionTitle || `Salvamento ${nextRevision}`,
            contentJson,
            plainText,
            pageSettingsJson,
            createdById: user?.id,
          },
        });
      }

      return onlineContent;
    });

    return {
      content: saved,
      createdVersion: shouldCreateVersion,
    };
  }

  async touchOnlinePresence(
    id: string,
    payload: UpdateOnlineDocumentPresenceDto,
    user?: RbacUser,
  ) {
    if (!user?.id) throwError('RBAC_FORBIDDEN');
    const sessionId = String(payload.sessionId ?? '').trim();
    if (!sessionId) {
      throwError('VALIDATION_ERROR', {
        field: 'sessionId',
        reason: 'required',
      });
    }

    await this.assertOnlineDocumentPresenceAccess(id, user);

    const now = new Date();
    const staleBefore = this.onlinePresenceStaleBefore(now);
    const normalizedColor = String(payload.color ?? '').trim().slice(0, 32);

    await this.prisma.$transaction([
      this.prisma.documentOnlinePresence.deleteMany({
        where: { documentId: id, lastSeenAt: { lt: staleBefore } },
      }),
      this.prisma.documentOnlinePresence.upsert({
        where: {
          documentId_sessionId: {
            documentId: id,
            sessionId,
          },
        },
        create: {
          documentId: id,
          sessionId,
          userId: user.id,
          name: user.name || user.email || 'Usuario',
          email: user.email || null,
          color: normalizedColor || null,
          connectedAt: now,
          lastSeenAt: now,
        },
        update: {
          userId: user.id,
          name: user.name || user.email || 'Usuario',
          email: user.email || null,
          color: normalizedColor || null,
          lastSeenAt: now,
        },
      }),
    ]);

    return this.listOnlinePresence(id, user);
  }

  async listOnlinePresence(id: string, user?: RbacUser) {
    await this.assertOnlineDocumentPresenceAccess(id, user);
    const staleBefore = this.onlinePresenceStaleBefore();

    await this.prisma.documentOnlinePresence.deleteMany({
      where: { documentId: id, lastSeenAt: { lt: staleBefore } },
    });

    const rows = await this.prisma.documentOnlinePresence.findMany({
      where: {
        documentId: id,
        lastSeenAt: { gte: staleBefore },
      },
      orderBy: { lastSeenAt: 'desc' },
      take: 80,
    });

    const byUser = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!byUser.has(row.userId)) byUser.set(row.userId, row);
    }

    return {
      items: Array.from(byUser.values()).map((row) => ({
        userId: row.userId,
        name: row.name,
        email: row.email,
        color: row.color,
        connectedAt: row.connectedAt,
        lastSeenAt: row.lastSeenAt,
        isCurrentUser: row.userId === user?.id,
      })),
      updatedAt: new Date().toISOString(),
    };
  }

  async listOnlineVersions(id: string, user?: RbacUser) {
    const document = await this.prisma.documentAsset.findUnique({
      where: { id },
      select: {
        id: true,
        assetType: true,
        localityId: true,
        deletedAt: true,
        cipavdReportFile: { select: { id: true } },
      },
    });
    if (!document) throwError('NOT_FOUND');
    this.assertDocumentNotDeleted(document);
    this.assertOnlineDocument(document);
    this.assertOnlineDocumentPermission(document, user, 'view');
    this.assertDocumentScope(document, user);

    const versions = await this.prisma.documentOnlineVersion.findMany({
      where: { documentId: id },
      orderBy: { revision: 'desc' },
      take: 80,
    });
    const userIds = Array.from(
      new Set(versions.map((item) => item.createdById).filter(Boolean)),
    ) as string[];
    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
    const userById = new Map(users.map((item) => [item.id, item]));

    return {
      items: versions.map((version) => ({
        id: version.id,
        revision: version.revision,
        title: version.title,
        plainText: version.plainText,
        createdAt: version.createdAt,
        createdBy: version.createdById
          ? (userById.get(version.createdById) ?? null)
          : null,
      })),
    };
  }

  async getOnlineDocumentCollaborationState(id: string, user: RbacUser) {
    const document = await this.prisma.documentAsset.findUnique({
      where: { id },
      include: {
        ...this.documentInclude(),
        onlineContent: true,
      },
    });
    if (!document) throwError('NOT_FOUND');
    this.assertDocumentNotDeleted(document);
    this.assertOnlineDocument(document);
    this.assertOnlineDocumentPermission(document, user, 'view');
    this.assertDocumentScope(document, user);

    return {
      document: this.mapDocumentWithAccess(document, user),
      content: document.onlineContent ?? {
        contentJson: INITIAL_ONLINE_DOCUMENT_CONTENT,
        plainText: '',
        pageSettingsJson: DEFAULT_ONLINE_DOCUMENT_PAGE_SETTINGS,
        savedRevision: 0,
        updatedAt: document.updatedAt,
        ydocState: null,
        ydocStateUpdatedAt: null,
      },
      canEdit: this.canEdit(document, user),
    };
  }

  async persistOnlineDocumentYDocState(
    id: string,
    ydocState: Uint8Array,
    user?: RbacUser,
  ) {
    const document = await this.prisma.documentAsset.findUnique({
      where: { id },
      select: {
        id: true,
        assetType: true,
        localityId: true,
        deletedAt: true,
        cipavdReportFile: { select: { id: true } },
      },
    });
    if (!document) throwError('NOT_FOUND');
    this.assertDocumentNotDeleted(document);
    this.assertOnlineDocument(document);
    this.assertOnlineDocumentPermission(document, user, 'view');
    this.assertDocumentScope(document, user);

    await this.prisma.documentOnlineContent.update({
      where: { documentId: id },
      data: {
        ydocState: Buffer.from(ydocState),
        ydocStateUpdatedAt: new Date(),
      },
    });
  }

  async storeOnlineDocumentCollaborationSnapshot(
    id: string,
    payload: {
      ydocState: Uint8Array;
      contentJson: unknown;
      plainText?: string | null;
      user?: RbacUser;
    },
  ) {
    const document = await this.prisma.documentAsset.findUnique({
      where: { id },
      include: {
        ...this.documentInclude(),
        onlineContent: true,
      },
    });
    if (!document) throwError('NOT_FOUND');
    this.assertDocumentNotDeleted(document);
    this.assertOnlineDocument(document);
    this.assertOnlineDocumentPermission(document, payload.user, 'update');
    this.assertDocumentScope(document, payload.user);
    if (payload.user && !this.canEdit(document, payload.user)) {
      throwError('RBAC_FORBIDDEN');
    }

    const contentJson = payload.contentJson as Prisma.InputJsonValue;
    const plainText = String(
      payload.plainText ?? this.extractPlainTextFromJson(payload.contentJson),
    ).slice(0, 500_000);
    const pageSettingsJson =
      (document.onlineContent?.pageSettingsJson as Prisma.InputJsonValue) ??
      (DEFAULT_ONLINE_DOCUMENT_PAGE_SETTINGS as Prisma.InputJsonValue);
    const nextRevision = (document.onlineContent?.savedRevision ?? 0) + 1;
    const shouldCreateVersion = nextRevision === 1 || nextRevision % 10 === 0;

    return this.prisma.$transaction(async (tx) => {
      const onlineContent = await tx.documentOnlineContent.upsert({
        where: { documentId: id },
        create: {
          documentId: id,
          contentJson,
          plainText,
          pageSettingsJson,
          ydocState: Buffer.from(payload.ydocState),
          ydocStateUpdatedAt: new Date(),
          savedRevision: nextRevision,
          lastSavedById: payload.user?.id,
        },
        update: {
          contentJson,
          plainText,
          ydocState: Buffer.from(payload.ydocState),
          ydocStateUpdatedAt: new Date(),
          savedRevision: nextRevision,
          lastSavedById: payload.user?.id,
        },
      });

      await tx.documentContent.upsert({
        where: { documentId: id },
        create: {
          documentId: id,
          parseStatus: DocumentParseStatus.EXTRACTED,
          textContent: plainText,
          parsedAt: new Date(),
          metadataJson: { source: 'online_document_collaboration' },
        },
        update: {
          parseStatus: DocumentParseStatus.EXTRACTED,
          textContent: plainText,
          parsedAt: new Date(),
          metadataJson: { source: 'online_document_collaboration' },
        },
      });

      await tx.documentAsset.update({
        where: { id },
        data: { updatedAt: new Date() },
      });

      if (shouldCreateVersion) {
        await tx.documentOnlineVersion.upsert({
          where: {
            documentId_revision: {
              documentId: id,
              revision: nextRevision,
            },
          },
          create: {
            documentId: id,
            revision: nextRevision,
            title: `Colaboracao ${nextRevision}`,
            contentJson,
            plainText,
            pageSettingsJson,
            createdById: payload.user?.id,
          },
          update: {
            title: `Colaboracao ${nextRevision}`,
            contentJson,
            plainText,
            pageSettingsJson,
            createdById: payload.user?.id,
          },
        });
      }

      return onlineContent;
    });
  }

  async getById(id: string, user?: RbacUser) {
    const document = await this.prisma.documentAsset.findUnique({
      where: { id },
      include: this.documentInclude(),
    });
    if (!document) throwError('NOT_FOUND');
    this.assertDocumentNotDeleted(document);

    if (
      this.shouldApplyLocalityScope(user) &&
      document.localityId &&
      document.localityId !== user?.localityId
    ) {
      throwError('RBAC_FORBIDDEN');
    }

    return this.mapDocumentWithAccess(document, user);
  }

  async update(id: string, payload: UpdateDocumentDto, user?: RbacUser) {
    const document = await this.prisma.documentAsset.findUnique({
      where: { id },
      include: this.documentInclude(),
    });
    if (!document) throwError('NOT_FOUND');
    this.assertDocumentNotDeleted(document);

    if (
      this.shouldApplyLocalityScope(user) &&
      document.localityId &&
      document.localityId !== user?.localityId
    ) {
      throwError('RBAC_FORBIDDEN');
    }
    if (!this.canEdit(document, user)) {
      throwError('RBAC_FORBIDDEN');
    }

    const normalizedLocalityId =
      payload.localityId === undefined
        ? undefined
        : payload.localityId === null || payload.localityId === ''
          ? null
          : payload.localityId;

    if (normalizedLocalityId !== undefined && normalizedLocalityId !== null) {
      const locality = await this.prisma.locality.findUnique({
        where: { id: normalizedLocalityId },
        select: { id: true },
      });
      if (!locality) throwError('NOT_FOUND');
    }

    if (
      this.shouldApplyLocalityScope(user) &&
      normalizedLocalityId !== undefined &&
      normalizedLocalityId !== null &&
      normalizedLocalityId !== user?.localityId
    ) {
      throwError('RBAC_FORBIDDEN');
    }

    const normalizedSubcategoryId =
      payload.subcategoryId === undefined
        ? undefined
        : payload.subcategoryId === null || payload.subcategoryId === ''
          ? null
          : payload.subcategoryId;

    const nextCategory = payload.category ?? document.category;

    let nextSubcategoryId: string | null | undefined = normalizedSubcategoryId;

    if (nextSubcategoryId !== undefined && nextSubcategoryId !== null) {
      const subcategory = await this.prisma.documentSubcategory.findUnique({
        where: { id: nextSubcategoryId },
        select: { id: true, category: true },
      });

      if (!subcategory) {
        throwError('NOT_FOUND');
      }

      if (subcategory.category !== nextCategory) {
        throwError('VALIDATION_ERROR', {
          field: 'subcategoryId',
          reason: 'subcategory_category_mismatch',
          expectedCategory: nextCategory,
        });
      }
    }

    if (
      nextSubcategoryId === undefined &&
      payload.category &&
      document.subcategory?.category !== payload.category
    ) {
      nextSubcategoryId = null;
    }

    const updated = await this.prisma.documentAsset.update({
      where: { id },
      data: {
        title: payload.title?.trim() || undefined,
        category: payload.category ?? undefined,
        sourcePath: payload.sourcePath?.trim() || undefined,
        localityId: normalizedLocalityId,
        subcategoryId: nextSubcategoryId,
      },
      include: this.documentInclude(),
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'documents',
      action: 'update_document',
      entityId: id,
      localityId: updated.localityId ?? undefined,
      diffJson: {
        title: updated.title,
        category: updated.category,
        localityId: updated.localityId ?? null,
        subcategoryId: updated.subcategoryId ?? null,
      },
    });

    return this.mapDocumentWithAccess(updated, user);
  }

  async delete(id: string, user?: RbacUser) {
    const document = await this.prisma.documentAsset.findUnique({
      where: { id },
      include: this.documentInclude(),
    });
    if (!document) throwError('NOT_FOUND');
    this.assertDocumentNotDeleted(document);
    this.assertDocumentScope(document, user);

    const deletedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.cipavdReportFile.deleteMany({
        where: { onlineDocumentId: id },
      });
      await tx.documentAsset.update({
        where: { id },
        data: {
          deletedAt,
          deletedById: user?.id ?? null,
          updatedAt: deletedAt,
        },
      });
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'documents',
      action: 'delete_document',
      entityId: id,
      localityId: document.localityId ?? undefined,
      diffJson: {
        title: document.title,
        fileName: document.fileName,
        assetType: document.assetType,
        category: document.category,
        subcategoryId: document.subcategoryId ?? null,
        sourcePath: document.sourcePath,
        deletedAt,
        deletedById: user?.id ?? null,
      },
    });

    return { success: true };
  }

  async listDeletionHistory(user?: RbacUser) {
    const where: Prisma.DocumentAssetWhereInput = {
      deletedAt: { not: null },
    };

    if (this.shouldApplyLocalityScope(user)) {
      where.OR = [
        { localityId: null },
        { localityId: user?.localityId as string },
      ];
    }

    const items = await this.prisma.documentAsset.findMany({
      where,
      include: this.documentInclude(),
      orderBy: [{ deletedAt: 'desc' }, { title: 'asc' }],
      take: 200,
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        fileName: item.fileName,
        assetType: item.assetType,
        category: item.category,
        subcategoryId: item.subcategoryId,
        subcategory: item.subcategory,
        localityId: item.localityId,
        locality: item.locality,
        sourcePath: item.sourcePath,
        deletedAt: item.deletedAt,
        deletedBy: item.deletedBy,
      })),
    };
  }

  async getContent(id: string, user?: RbacUser) {
    const document = await this.getById(id, user);
    const [content, links] = await this.prisma.$transaction([
      this.prisma.documentContent.findUnique({
        where: { documentId: id },
        select: {
          parseStatus: true,
          parsedAt: true,
          textContent: true,
          metadataJson: true,
        },
      }),
      this.prisma.documentLink.findMany({
        where: { documentId: id },
        orderBy: [{ entityType: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);

    const enrichedLinks = await this.enrichLinks(links);

    return {
      document,
      content,
      links: enrichedLinks,
    };
  }

  async listLinks(
    filters: {
      documentId?: string;
      entityType?: string;
      entityId?: string;
      pageSize?: string;
    },
    user?: RbacUser,
  ) {
    const where: Prisma.DocumentLinkWhereInput = {};
    if (filters.documentId) where.documentId = filters.documentId;
    if (filters.entityId) where.entityId = filters.entityId;

    if (filters.entityType) {
      where.entityType = this.parseEntityType(filters.entityType);
    }

    const scopedDocumentWhere = this.documentScopeWhere(user);
    if (Object.keys(scopedDocumentWhere).length > 0) {
      where.document = scopedDocumentWhere;
    }

    const take = this.parseTake(filters.pageSize, 200, 1000);

    const links = await this.prisma.documentLink.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take,
      include: {
        document: {
          include: this.documentInclude(),
        },
      },
    });

    const enriched = await this.enrichLinks(links);
    return {
      items: enriched.map((item: any) => ({
        ...item,
        document: item.document
          ? this.mapDocumentWithAccess(item.document, user)
          : null,
      })),
    };
  }

  async createLink(
    payload: {
      documentId: string;
      entityType: string;
      entityId: string;
      label?: string | null;
    },
    user?: RbacUser,
  ) {
    const documentId = String(payload.documentId ?? '').trim();
    const entityId = String(payload.entityId ?? '').trim();
    const entityType = this.parseEntityType(payload.entityType);
    const label = payload.label?.trim() || null;

    if (!documentId) {
      throwError('VALIDATION_ERROR', {
        field: 'documentId',
        reason: 'required',
      });
    }
    if (!entityId) {
      throwError('VALIDATION_ERROR', { field: 'entityId', reason: 'required' });
    }

    const document = await this.prisma.documentAsset.findUnique({
      where: { id: documentId },
      include: this.documentInclude(),
    });
    if (!document) throwError('NOT_FOUND');
    this.assertDocumentNotDeleted(document);
    this.assertDocumentScope(document, user);

    await this.assertLinkEntityExists(entityType, entityId);

    const link = await this.prisma.documentLink.upsert({
      where: {
        documentId_entityType_entityId: {
          documentId,
          entityType,
          entityId,
        },
      },
      update: {
        label,
      },
      create: {
        documentId,
        entityType,
        entityId,
        label,
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'documents',
      action: 'create_link',
      entityId: link.id,
      localityId: document.localityId ?? undefined,
      diffJson: {
        documentId: link.documentId,
        entityType: link.entityType,
        entityId: link.entityId,
      },
    });

    const [enriched] = await this.enrichLinks([link]);
    return {
      ...enriched,
      document: this.mapDocumentWithAccess(document, user),
    };
  }

  async updateLink(
    id: string,
    payload: {
      documentId?: string;
      entityId?: string;
      label?: string | null;
    },
    user?: RbacUser,
  ) {
    const existing = await this.prisma.documentLink.findUnique({
      where: { id },
      include: {
        document: {
          include: this.documentInclude(),
        },
      },
    });
    if (!existing) throwError('NOT_FOUND');
    this.assertDocumentNotDeleted(existing.document);
    this.assertDocumentScope(existing.document, user);

    const nextDocumentId =
      payload.documentId === undefined
        ? existing.documentId
        : String(payload.documentId ?? '').trim();
    const nextEntityId =
      payload.entityId === undefined
        ? existing.entityId
        : String(payload.entityId ?? '').trim();
    const nextLabel =
      payload.label === undefined
        ? existing.label
        : payload.label?.trim() || null;

    if (!nextDocumentId) {
      throwError('VALIDATION_ERROR', {
        field: 'documentId',
        reason: 'required',
      });
    }
    if (!nextEntityId) {
      throwError('VALIDATION_ERROR', { field: 'entityId', reason: 'required' });
    }

    let nextDocument = existing.document;
    if (nextDocumentId !== existing.documentId) {
      const document = await this.prisma.documentAsset.findUnique({
        where: { id: nextDocumentId },
        include: this.documentInclude(),
      });
      if (!document) throwError('NOT_FOUND');
      this.assertDocumentNotDeleted(document);
      this.assertDocumentScope(document, user);
      nextDocument = document;
    }

    if (nextEntityId !== existing.entityId) {
      await this.assertLinkEntityExists(existing.entityType, nextEntityId);
    }

    const updated = await this.prisma.documentLink.update({
      where: { id },
      data: {
        documentId: nextDocumentId,
        entityId: nextEntityId,
        label: nextLabel,
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'documents',
      action: 'update_link',
      entityId: id,
      localityId: nextDocument.localityId ?? undefined,
      diffJson: {
        documentId: updated.documentId,
        entityType: updated.entityType,
        entityId: updated.entityId,
      },
    });

    const [enriched] = await this.enrichLinks([updated]);
    return {
      ...enriched,
      document: this.mapDocumentWithAccess(nextDocument, user),
    };
  }

  async deleteLink(id: string, user?: RbacUser) {
    const existing = await this.prisma.documentLink.findUnique({
      where: { id },
      include: {
        document: {
          select: { id: true, localityId: true },
        },
      },
    });
    if (!existing) throwError('NOT_FOUND');
    this.assertDocumentScope(existing.document, user);

    await this.prisma.documentLink.delete({ where: { id } });

    await this.audit.log({
      userId: user?.id,
      resource: 'documents',
      action: 'delete_link',
      entityId: id,
      localityId: existing.document.localityId ?? undefined,
      diffJson: {
        documentId: existing.documentId,
        entityType: existing.entityType,
        entityId: existing.entityId,
      },
    });

    return { success: true };
  }

  async listLinkCandidates(
    filters: {
      entityType: string;
      q?: string;
      pageSize?: string;
    },
    user?: RbacUser,
  ) {
    const entityType = this.parseEntityType(filters.entityType);
    const q = String(filters.q ?? '').trim();
    const take = this.parseTake(filters.pageSize, 30, 100);

    if (
      entityType !== DocumentLinkEntity.TASK_INSTANCE &&
      entityType !== DocumentLinkEntity.ACTIVITY &&
      entityType !== DocumentLinkEntity.MEETING
    ) {
      throwError('VALIDATION_ERROR', {
        field: 'entityType',
        reason: 'unsupported_entity_type',
        allowed: [
          DocumentLinkEntity.TASK_INSTANCE,
          DocumentLinkEntity.ACTIVITY,
          DocumentLinkEntity.MEETING,
        ],
      });
    }

    if (entityType === DocumentLinkEntity.TASK_INSTANCE) {
      const where: Prisma.TaskInstanceWhereInput = {};
      const andClauses: Prisma.TaskInstanceWhereInput[] = [];
      if (this.shouldApplyLocalityScope(user))
        where.localityId = user?.localityId as string;
      if (user?.specialtyId) {
        andClauses.push({
          OR: [{ specialtyId: null }, { specialtyId: user.specialtyId }],
        });
      }
      if (q) {
        andClauses.push({
          OR: [
            { taskTemplate: { title: { contains: q, mode: 'insensitive' } } },
            { locality: { name: { contains: q, mode: 'insensitive' } } },
            { locality: { code: { contains: q, mode: 'insensitive' } } },
            { id: { contains: q, mode: 'insensitive' } },
          ],
        });
      }
      if (andClauses.length > 0) {
        where.AND = andClauses;
      }
      const rows = await this.prisma.taskInstance.findMany({
        where,
        take,
        orderBy: [{ dueDate: 'desc' }],
        select: {
          id: true,
          dueDate: true,
          taskTemplate: { select: { title: true } },
          locality: { select: { code: true, name: true } },
        },
      });
      return {
        items: rows.map((row) => ({
          id: row.id,
          label: row.taskTemplate?.title ?? 'Tarefa',
          subtitle: row.locality?.code ?? row.locality?.name ?? null,
          extra: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : null,
        })),
      };
    }

    if (entityType === DocumentLinkEntity.ACTIVITY) {
      const where: Prisma.ActivityWhereInput = {};
      if (this.shouldApplyLocalityScope(user)) {
        where.OR = [
          { localityId: null },
          { localityId: user?.localityId as string },
        ];
      }
      if (q) {
        const qWhere: Prisma.ActivityWhereInput = {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { id: { contains: q, mode: 'insensitive' } },
          ],
        };
        where.AND = where.AND
          ? Array.isArray(where.AND)
            ? [...where.AND, qWhere]
            : [where.AND, qWhere]
          : [qWhere];
      }
      const rows = await this.prisma.activity.findMany({
        where,
        take,
        orderBy: [{ eventDate: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          title: true,
          eventDate: true,
          locality: { select: { code: true, name: true } },
        },
      });
      return {
        items: rows.map((row) => ({
          id: row.id,
          label: row.title,
          subtitle: row.locality?.code ?? row.locality?.name ?? null,
          extra: row.eventDate
            ? row.eventDate.toISOString().slice(0, 10)
            : null,
        })),
      };
    }

    const where: Prisma.MeetingWhereInput = {};
    if (this.shouldApplyLocalityScope(user)) {
      where.OR = [
        { localityId: null },
        { localityId: user?.localityId as string },
      ];
    }
    if (q) {
      const qWhere: Prisma.MeetingWhereInput = {
        OR: [
          { scope: { contains: q, mode: 'insensitive' } },
          { id: { contains: q, mode: 'insensitive' } },
        ],
      };
      where.AND = where.AND
        ? Array.isArray(where.AND)
          ? [...where.AND, qWhere]
          : [where.AND, qWhere]
        : [qWhere];
    }
    const rows = await this.prisma.meeting.findMany({
      where,
      take,
      orderBy: [{ datetime: 'desc' }],
      select: {
        id: true,
        datetime: true,
        scope: true,
        locality: { select: { code: true, name: true } },
      },
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        label: row.scope?.trim() || 'Reunião',
        subtitle: row.locality?.code ?? row.locality?.name ?? null,
        extra: row.datetime.toISOString().slice(0, 16).replace('T', ' '),
      })),
    };
  }

  async coverage(user?: RbacUser) {
    const whereDocScope = this.documentScopeWhere(user);

    const [
      totalDocuments,
      documentsWithoutLinks,
      parseRows,
      linkRows,
      documentRows,
    ] = await this.prisma.$transaction([
      this.prisma.documentAsset.count({ where: whereDocScope }),
      this.prisma.documentAsset.count({
        where: {
          ...whereDocScope,
          links: { none: {} },
        },
      }),
      this.prisma.documentContent.findMany({
        where: {
          document: whereDocScope,
        },
        select: { parseStatus: true },
      }),
      this.prisma.documentLink.findMany({
        where: {
          document: whereDocScope,
        },
        select: { documentId: true, entityType: true },
      }),
      this.prisma.documentAsset.findMany({
        where: whereDocScope,
        select: {
          category: true,
          subcategoryId: true,
          subcategory: {
            select: { id: true, name: true, category: true, parentId: true },
          },
        },
      }),
    ]);

    const linkedDocuments = new Set(linkRows.map((row) => row.documentId)).size;

    const parseStatusMap = new Map<string, number>();
    for (const row of parseRows) {
      const key = row.parseStatus;
      parseStatusMap.set(key, (parseStatusMap.get(key) ?? 0) + 1);
    }

    const linkTypeMap = new Map<string, number>();
    for (const row of linkRows) {
      const key = row.entityType;
      linkTypeMap.set(key, (linkTypeMap.get(key) ?? 0) + 1);
    }

    const byCategoryMap = new Map<DocumentCategory, number>();
    const bySubcategoryMap = new Map<
      string,
      {
        id: string;
        name: string;
        category: DocumentCategory;
        parentId: string | null;
        count: number;
      }
    >();

    for (const row of documentRows) {
      byCategoryMap.set(
        row.category,
        (byCategoryMap.get(row.category) ?? 0) + 1,
      );
      if (!row.subcategoryId || !row.subcategory) continue;
      const current = bySubcategoryMap.get(row.subcategoryId);
      if (current) {
        current.count += 1;
      } else {
        bySubcategoryMap.set(row.subcategoryId, {
          id: row.subcategory.id,
          name: row.subcategory.name,
          category: row.subcategory.category,
          parentId: row.subcategory.parentId,
          count: 1,
        });
      }
    }

    return {
      totalDocuments,
      linkedDocuments,
      documentsWithoutLinks,
      parseStatus: Array.from(parseStatusMap.entries()).map(
        ([parseStatus, count]) => ({
          parseStatus,
          count,
        }),
      ),
      linksByEntityType: Array.from(linkTypeMap.entries()).map(
        ([entityType, count]) => ({
          entityType,
          count,
        }),
      ),
      byCategory: Array.from(byCategoryMap.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
      bySubcategory: Array.from(bySubcategoryMap.values()).sort(
        (a, b) => b.count - a.count,
      ),
    };
  }

  private async assertNoSubcategoryCycle(
    subcategoryId: string,
    nextParentId: string,
  ) {
    let cursor: string | null = nextParentId;
    const visited = new Set<string>();
    while (cursor) {
      if (cursor === subcategoryId) {
        throwError('VALIDATION_ERROR', {
          field: 'parentId',
          reason: 'cyclic_parent',
        });
      }
      if (visited.has(cursor)) {
        throwError('VALIDATION_ERROR', {
          field: 'parentId',
          reason: 'cyclic_parent',
        });
      }
      visited.add(cursor);

      const parentRow: { parentId: string | null } | null =
        await this.prisma.documentSubcategory.findUnique({
          where: { id: cursor },
          select: { parentId: true },
        });
      cursor = parentRow?.parentId ?? null;
    }
  }

  private async collectSubcategorySubtreeIds(rootId: string) {
    const ids = new Set<string>([rootId]);
    let frontier = [rootId];

    while (frontier.length > 0) {
      const children = await this.prisma.documentSubcategory.findMany({
        where: { parentId: { in: frontier } },
        select: { id: true },
      });
      frontier = [];
      for (const child of children) {
        if (ids.has(child.id)) continue;
        ids.add(child.id);
        frontier.push(child.id);
      }
    }

    return Array.from(ids);
  }

  private async enrichLinks(
    links: Array<{
      id: string;
      documentId: string;
      entityType: DocumentLinkEntity;
      entityId: string;
      label: string | null;
      createdAt: Date;
    }>,
  ) {
    const idsByType = new Map<DocumentLinkEntity, Set<string>>();
    for (const link of links) {
      if (!idsByType.has(link.entityType))
        idsByType.set(link.entityType, new Set());
      idsByType.get(link.entityType)?.add(link.entityId);
    }

    const ids = (entityType: DocumentLinkEntity) =>
      Array.from(idsByType.get(entityType) ?? []);

    const [
      taskInstances,
      taskTemplates,
      activities,
      meetings,
      elos,
      localities,
    ] = await this.prisma.$transaction([
      this.prisma.taskInstance.findMany({
        where: { id: { in: ids(DocumentLinkEntity.TASK_INSTANCE) } },
        select: {
          id: true,
          taskTemplate: { select: { title: true } },
          locality: { select: { code: true, name: true } },
        },
      }),
      this.prisma.taskTemplate.findMany({
        where: { id: { in: ids(DocumentLinkEntity.TASK_TEMPLATE) } },
        select: { id: true, title: true },
      }),
      this.prisma.activity.findMany({
        where: { id: { in: ids(DocumentLinkEntity.ACTIVITY) } },
        select: { id: true, title: true, eventDate: true },
      }),
      this.prisma.meeting.findMany({
        where: { id: { in: ids(DocumentLinkEntity.MEETING) } },
        select: { id: true, scope: true, datetime: true },
      }),
      this.prisma.elo.findMany({
        where: { id: { in: ids(DocumentLinkEntity.ELO) } },
        select: { id: true, name: true, rank: true },
      }),
      this.prisma.locality.findMany({
        where: { id: { in: ids(DocumentLinkEntity.LOCALITY) } },
        select: { id: true, code: true, name: true },
      }),
    ]);

    const labelByTypeAndId = new Map<string, string>();

    for (const item of taskInstances) {
      const localityLabel = item.locality?.code ?? item.locality?.name ?? '';
      const title = item.taskTemplate?.title ?? 'Tarefa';
      const label = localityLabel ? `${title} (${localityLabel})` : title;
      labelByTypeAndId.set(
        `${DocumentLinkEntity.TASK_INSTANCE}:${item.id}`,
        label,
      );
    }

    for (const item of taskTemplates) {
      labelByTypeAndId.set(
        `${DocumentLinkEntity.TASK_TEMPLATE}:${item.id}`,
        item.title,
      );
    }

    for (const item of activities) {
      const date = item.eventDate
        ? item.eventDate.toISOString().slice(0, 10)
        : null;
      const label = date ? `${item.title} (${date})` : item.title;
      labelByTypeAndId.set(`${DocumentLinkEntity.ACTIVITY}:${item.id}`, label);
    }

    for (const item of meetings) {
      const datetime = item.datetime
        .toISOString()
        .slice(0, 16)
        .replace('T', ' ');
      const scope = item.scope?.trim();
      labelByTypeAndId.set(
        `${DocumentLinkEntity.MEETING}:${item.id}`,
        scope ? `Reunião ${datetime} - ${scope}` : `Reunião ${datetime}`,
      );
    }

    for (const item of elos) {
      const label = item.rank ? `${item.rank} - ${item.name}` : item.name;
      labelByTypeAndId.set(`${DocumentLinkEntity.ELO}:${item.id}`, label);
    }

    for (const item of localities) {
      const label = item.code ? `${item.code} - ${item.name}` : item.name;
      labelByTypeAndId.set(`${DocumentLinkEntity.LOCALITY}:${item.id}`, label);
    }

    return links.map((link) => ({
      ...link,
      entityDisplayName:
        labelByTypeAndId.get(`${link.entityType}:${link.entityId}`) ??
        link.label ??
        link.entityId,
    }));
  }

  private assertOnlineDocument(document: { assetType?: DocumentAssetType }) {
    if (document.assetType !== DocumentAssetType.ONLINE_DOC) {
      throwError('VALIDATION_ERROR', {
        field: 'documentId',
        reason: 'not_online_document',
      });
    }
  }

  private async assertOnlineDocumentPresenceAccess(id: string, user?: RbacUser) {
    const document = await this.prisma.documentAsset.findUnique({
      where: { id },
      select: {
        id: true,
        assetType: true,
        localityId: true,
        deletedAt: true,
        cipavdReportFile: { select: { id: true } },
      },
    });
    if (!document) throwError('NOT_FOUND');
    this.assertDocumentNotDeleted(document);
    this.assertOnlineDocument(document);
    this.assertOnlineDocumentPermission(document, user, 'view');
    this.assertDocumentScope(document, user);
    return document;
  }

  private onlinePresenceStaleBefore(now = new Date()) {
    return new Date(now.getTime() - ONLINE_DOCUMENT_PRESENCE_TTL_MS);
  }

  private buildOnlineDocumentSourcePath(
    category: DocumentCategory,
    title: string,
  ) {
    return `Acervo online/${category}/${title}`;
  }

  private sanitizeOnlineDocumentFileBase(value: string) {
    const normalized = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120);
    return normalized || 'documento-online';
  }

  private extractPlainTextFromJson(value: unknown): string {
    const chunks: string[] = [];
    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object') return;
      const current = node as {
        type?: unknown;
        text?: unknown;
        content?: unknown;
      };
      if (typeof current.text === 'string') {
        chunks.push(current.text);
      }
      if (Array.isArray(current.content)) {
        for (const child of current.content) {
          walk(child);
        }
      }
      if (
        current.type === 'paragraph' ||
        current.type === 'heading' ||
        current.type === 'listItem'
      ) {
        chunks.push('\n');
      }
    };
    walk(value);
    return chunks.join('').replace(/\n{3,}/g, '\n\n').trim();
  }

  private encodeOnlineDocumentYDocState(contentJson: unknown) {
    const ydoc = TiptapTransformer.toYdoc(
      contentJson as any,
      'default',
      documentEditorExtensions as any,
    );
    const state = Buffer.from(Y.encodeStateAsUpdate(ydoc));
    ydoc.destroy();
    return state;
  }

  private mapDocumentWithAccess(document: any, user?: RbacUser) {
    return {
      ...document,
      canEdit: this.canEdit(document, user),
    };
  }

  private canEdit(
    document: {
      tagsJson?: unknown;
      activity?: { createdById?: string | null } | null;
      cipavdReportFile?: { id?: string | null } | null;
    },
    user?: RbacUser,
  ) {
    if (!user) return false;
    if (this.isAdminUser(user)) return true;
    if (
      document.cipavdReportFile &&
      this.hasCipavdReportsPermission(user, 'update')
    ) {
      return true;
    }
    if (
      document.activity?.createdById &&
      document.activity.createdById === user.id
    )
      return true;

    const tags = this.asRecord(document.tagsJson);
    const createdById =
      typeof tags?.createdById === 'string' ? tags.createdById : null;
    const createdByEmail =
      typeof tags?.createdByEmail === 'string'
        ? tags.createdByEmail.toLowerCase()
        : null;

    if (createdById && createdById === user.id) return true;
    if (createdByEmail && createdByEmail === user.email.toLowerCase())
      return true;

    return false;
  }

  private isAdminUser(user: RbacUser) {
    const hasPermission = (resource: string, action: string) =>
      user.permissions.some(
        (permission) =>
          (permission.resource === resource || permission.resource === '*') &&
          (permission.action === action || permission.action === '*'),
      );

    if (
      hasPermission('roles', 'view') ||
      hasPermission('roles', 'update') ||
      hasPermission('admin_rbac', 'export')
    ) {
      return true;
    }

    return user.roles.some((role) => role.name.toLowerCase().includes('admin'));
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return null;
    return value as Record<string, unknown>;
  }

  private documentScopeWhere(user?: RbacUser): Prisma.DocumentAssetWhereInput {
    const where: Prisma.DocumentAssetWhereInput = { deletedAt: null };
    if (!this.shouldApplyLocalityScope(user)) return where;
    return {
      ...where,
      OR: [{ localityId: null }, { localityId: user?.localityId as string }],
    };
  }

  private documentInclude() {
    return {
      locality: { select: { id: true, code: true, name: true } },
      subcategory: {
        select: { id: true, name: true, category: true, parentId: true },
      },
      activity: {
        select: { id: true, title: true, eventDate: true, createdById: true },
      },
      meeting: { select: { id: true, datetime: true, scope: true } },
      deletedBy: { select: { id: true, name: true, email: true } },
      content: { select: { parseStatus: true, parsedAt: true } },
      cipavdReportFile: { select: { id: true } },
      _count: { select: { links: true } },
    };
  }

  private assertDocumentNotDeleted(document: { deletedAt?: Date | null }) {
    if (document.deletedAt) {
      throwError('NOT_FOUND');
    }
  }

  private assertOnlineDocumentPermission(
    document: {
      cipavdReportFile?: { id?: string | null } | null;
    },
    user: RbacUser | undefined,
    action: 'view' | 'update',
  ) {
    if (this.hasDocumentPermission(user, action)) return;
    if (
      document.cipavdReportFile &&
      this.hasCipavdReportsPermission(user, action)
    ) {
      return;
    }
    throwError('RBAC_FORBIDDEN');
  }

  private hasDocumentPermission(
    user: RbacUser | undefined,
    action: 'view' | 'update',
  ) {
    return (
      hasPermission(user, 'documents', action) || hasAnyRole(user, [ROLE_TI])
    );
  }

  private hasCipavdReportsPermission(
    user: RbacUser | undefined,
    action: 'view' | 'update',
  ) {
    if (!hasAnyRole(user, [ROLE_COMGEP, ROLE_TI])) return false;
    return (
      hasPermission(user, 'cipavd_reports', action, PermissionScope.NATIONAL) ||
      hasAnyRole(user, [ROLE_TI])
    );
  }

  private parseEntityType(value: string): DocumentLinkEntity {
    const normalized = String(value ?? '')
      .trim()
      .toUpperCase();
    if (
      normalized !== DocumentLinkEntity.TASK_INSTANCE &&
      normalized !== DocumentLinkEntity.TASK_TEMPLATE &&
      normalized !== DocumentLinkEntity.ACTIVITY &&
      normalized !== DocumentLinkEntity.MEETING &&
      normalized !== DocumentLinkEntity.ELO &&
      normalized !== DocumentLinkEntity.LOCALITY
    ) {
      throwError('VALIDATION_ERROR', {
        field: 'entityType',
        reason: 'invalid_enum',
      });
    }
    return normalized as DocumentLinkEntity;
  }

  private parseTake(
    pageSizeRaw: string | undefined,
    defaultValue: number,
    maxValue: number,
  ) {
    const parsed = Number(pageSizeRaw);
    if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
    return Math.min(Math.floor(parsed), maxValue);
  }

  private assertDocumentScope(
    document: { localityId?: string | null },
    user?: RbacUser,
  ) {
    if (!this.shouldApplyLocalityScope(user)) return;
    if (!document.localityId) return;
    if (document.localityId !== (user?.localityId as string)) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private shouldApplyLocalityScope(user?: RbacUser) {
    if (!user?.localityId) return false;
    if (this.isAdminUser(user)) return false;

    const hasNationalSearchScope = user.permissions.some(
      (permission) =>
        (permission.resource === 'documents' || permission.resource === '*') &&
        (permission.action === 'view' || permission.action === '*') &&
        permission.scope === PermissionScope.NATIONAL,
    );

    return !hasNationalSearchScope;
  }

  private async assertLinkEntityExists(
    entityType: DocumentLinkEntity,
    entityId: string,
  ) {
    if (entityType === DocumentLinkEntity.TASK_INSTANCE) {
      const found = await this.prisma.taskInstance.findUnique({
        where: { id: entityId },
        select: { id: true },
      });
      if (!found) throwError('NOT_FOUND');
      return;
    }
    if (entityType === DocumentLinkEntity.TASK_TEMPLATE) {
      const found = await this.prisma.taskTemplate.findUnique({
        where: { id: entityId },
        select: { id: true },
      });
      if (!found) throwError('NOT_FOUND');
      return;
    }
    if (entityType === DocumentLinkEntity.ACTIVITY) {
      const found = await this.prisma.activity.findUnique({
        where: { id: entityId },
        select: { id: true },
      });
      if (!found) throwError('NOT_FOUND');
      return;
    }
    if (entityType === DocumentLinkEntity.MEETING) {
      const found = await this.prisma.meeting.findUnique({
        where: { id: entityId },
        select: { id: true },
      });
      if (!found) throwError('NOT_FOUND');
      return;
    }
    if (entityType === DocumentLinkEntity.ELO) {
      const found = await this.prisma.elo.findUnique({
        where: { id: entityId },
        select: { id: true },
      });
      if (!found) throwError('NOT_FOUND');
      return;
    }
    const found = await this.prisma.locality.findUnique({
      where: { id: entityId },
      select: { id: true },
    });
    if (!found) throwError('NOT_FOUND');
  }
}
