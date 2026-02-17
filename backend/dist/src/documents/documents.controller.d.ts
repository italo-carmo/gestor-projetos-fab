import type { Response } from 'express';
import type { RbacUser } from '../rbac/rbac.types';
import { DocumentsService } from './documents.service';
import { CreateDocumentSubcategoryDto } from './dto/create-document-subcategory.dto';
import { UpdateDocumentSubcategoryDto } from './dto/update-document-subcategory.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
export declare class DocumentsController {
    private readonly documents;
    constructor(documents: DocumentsService);
    list(q: string | undefined, category: string | undefined, subcategoryId: string | undefined, localityId: string | undefined, page: string | undefined, pageSize: string | undefined, user: RbacUser): Promise<{
        items: any[];
        page: number;
        pageSize: number;
        total: number;
    }>;
    listSubcategories(category: string | undefined, user: RbacUser): Promise<{
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
    createSubcategory(dto: CreateDocumentSubcategoryDto, user: RbacUser): Promise<{
        documentCount: number;
        totalDocumentCount: number;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        category: import("@prisma/client").$Enums.DocumentCategory;
        parentId: string | null;
    }>;
    updateSubcategory(id: string, dto: UpdateDocumentSubcategoryDto, user: RbacUser): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        category: import("@prisma/client").$Enums.DocumentCategory;
        parentId: string | null;
    }>;
    deleteSubcategory(id: string, user: RbacUser): Promise<{
        deletedFolders: number;
        unlinkedDocuments: number;
    }>;
    coverage(user: RbacUser): Promise<{
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
            category: import("@prisma/client").DocumentCategory;
            parentId: string | null;
            count: number;
        }[];
    }>;
    getContent(id: string, user: RbacUser): Promise<{
        document: any;
        content: {
            parseStatus: import("@prisma/client").$Enums.DocumentParseStatus;
            textContent: string | null;
            parsedAt: Date | null;
            metadataJson: import("@prisma/client/runtime/client").JsonValue;
        } | null;
        links: {
            entityDisplayName: string;
            id: string;
            documentId: string;
            entityType: import("@prisma/client").DocumentLinkEntity;
            entityId: string;
            label: string | null;
            createdAt: Date;
        }[];
    }>;
    getById(id: string, user: RbacUser): Promise<any>;
    update(id: string, dto: UpdateDocumentDto, user: RbacUser): Promise<any>;
    download(id: string, user: RbacUser, res: Response): Promise<void>;
}
