import { DocumentCategory, DocumentLinkEntity, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { RbacUser } from '../rbac/rbac.types';
import { CreateDocumentSubcategoryDto } from './dto/create-document-subcategory.dto';
import { UpdateDocumentSubcategoryDto } from './dto/update-document-subcategory.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
export declare class DocumentsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(filters: {
        q?: string;
        category?: string;
        subcategoryId?: string;
        localityId?: string;
        page?: string;
        pageSize?: string;
    }, user?: RbacUser): Promise<{
        items: any[];
        page: number;
        pageSize: number;
        total: number;
    }>;
    listSubcategories(filters: {
        category?: string;
    }, user?: RbacUser): Promise<{
        items: {
            fullPath: string;
            depth: number;
            documentCount: number;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            category: import("@prisma/client").$Enums.DocumentCategory;
            parentId: string | null;
        }[];
        tree: any[];
    }>;
    createSubcategory(payload: CreateDocumentSubcategoryDto, _user?: RbacUser): Promise<{
        documentCount: number;
        totalDocumentCount: number;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        category: import("@prisma/client").$Enums.DocumentCategory;
        parentId: string | null;
    }>;
    updateSubcategory(id: string, payload: UpdateDocumentSubcategoryDto, _user?: RbacUser): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        category: import("@prisma/client").$Enums.DocumentCategory;
        parentId: string | null;
    }>;
    deleteSubcategory(id: string, _user?: RbacUser): Promise<{
        deletedFolders: number;
        unlinkedDocuments: number;
    }>;
    getById(id: string, user?: RbacUser): Promise<any>;
    update(id: string, payload: UpdateDocumentDto, user?: RbacUser): Promise<any>;
    getContent(id: string, user?: RbacUser): Promise<{
        document: any;
        content: {
            parseStatus: import("@prisma/client").$Enums.DocumentParseStatus;
            textContent: string | null;
            parsedAt: Date | null;
            metadataJson: Prisma.JsonValue;
        } | null;
        links: {
            entityDisplayName: string;
            id: string;
            documentId: string;
            entityType: DocumentLinkEntity;
            entityId: string;
            label: string | null;
            createdAt: Date;
        }[];
    }>;
    coverage(user?: RbacUser): Promise<{
        totalDocuments: number;
        linkedDocuments: number;
        documentsWithoutLinks: number;
        parseStatus: {
            parseStatus: string;
            count: number;
        }[];
        linksByEntityType: {
            entityType: string;
            count: number;
        }[];
        byCategory: {
            category: import("@prisma/client").$Enums.DocumentCategory;
            count: number;
        }[];
        bySubcategory: {
            id: string;
            name: string;
            category: DocumentCategory;
            parentId: string | null;
            count: number;
        }[];
    }>;
    private assertNoSubcategoryCycle;
    private collectSubcategorySubtreeIds;
    private enrichLinks;
    private mapDocumentWithAccess;
    private canEdit;
    private isAdminUser;
    private asRecord;
    private documentScopeWhere;
    private documentInclude;
}
