import { Injectable } from '@nestjs/common';
import {
  DocumentCategory,
  DocumentLinkEntity,
  PermissionScope,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { throwError } from '../common/http-error';
import type { RbacUser } from '../rbac/rbac.types';
import { parsePagination } from '../common/pagination';
import { AuditService } from '../audit/audit.service';
import { CreateDocumentSubcategoryDto } from './dto/create-document-subcategory.dto';
import { UpdateDocumentSubcategoryDto } from './dto/update-document-subcategory.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

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
    const where: Prisma.DocumentAssetWhereInput = {};

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

  async getById(id: string, user?: RbacUser) {
    const document = await this.prisma.documentAsset.findUnique({
      where: { id },
      include: this.documentInclude(),
    });
    if (!document) throwError('NOT_FOUND');

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
      throwError('VALIDATION_ERROR', { field: 'documentId', reason: 'required' });
    }
    if (!entityId) {
      throwError('VALIDATION_ERROR', { field: 'entityId', reason: 'required' });
    }

    const document = await this.prisma.documentAsset.findUnique({
      where: { id: documentId },
      include: this.documentInclude(),
    });
    if (!document) throwError('NOT_FOUND');
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
      payload.label === undefined ? existing.label : payload.label?.trim() || null;

    if (!nextDocumentId) {
      throwError('VALIDATION_ERROR', { field: 'documentId', reason: 'required' });
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
        andClauses.push({ OR: [{ specialtyId: null }, { specialtyId: user.specialtyId }] });
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
          extra: row.eventDate ? row.eventDate.toISOString().slice(0, 10) : null,
        })),
      };
    }

    const where: Prisma.MeetingWhereInput = {};
    if (this.shouldApplyLocalityScope(user)) {
      where.OR = [{ localityId: null }, { localityId: user?.localityId as string }];
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
    },
    user?: RbacUser,
  ) {
    if (!user) return false;
    if (this.isAdminUser(user)) return true;
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
    if (!this.shouldApplyLocalityScope(user)) return {};
    return {
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
      content: { select: { parseStatus: true, parsedAt: true } },
      _count: { select: { links: true } },
    };
  }

  private parseEntityType(value: string): DocumentLinkEntity {
    const normalized = String(value ?? '').trim().toUpperCase();
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
        (permission.resource === 'search' || permission.resource === '*') &&
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
