import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { RbacUser } from '../rbac/rbac.types';
type LibraryScope = 'SMIF' | 'CIPAVD';
export declare class LibraryService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    getData(scopeRaw?: string): Promise<{
        scope: LibraryScope;
        photos: ({
            locality: {
                id: string;
                name: string;
                code: string;
                catalogType: import("@prisma/client").$Enums.LocalityCatalogType;
            } | null;
        } & {
            id: string;
            title: string;
            createdAt: Date;
            updatedAt: Date;
            scope: import("@prisma/client").$Enums.ActivityScope;
            localityId: string | null;
            sortOrder: number;
            createdById: string | null;
            fileUrl: string | null;
            storageKey: string | null;
            mimeType: string | null;
            imageData: string;
        })[];
        documents: {
            id: string;
            title: string;
            createdAt: Date;
            updatedAt: Date;
            scope: import("@prisma/client").$Enums.ActivityScope;
            fileName: string;
            createdById: string | null;
            fileUrl: string;
            storageKey: string | null;
            mimeType: string | null;
            fileSize: number | null;
        }[];
        localities: {
            id: string;
            code: string;
            name: string;
        }[];
        settings: {
            carouselIntervalSeconds: number;
        };
    }>;
    ensureEditorAccess(user: RbacUser | undefined, action: 'create' | 'update' | 'delete'): void;
    updateSettings(payload: {
        carouselIntervalSeconds: number;
    }, user?: RbacUser): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        carouselIntervalSeconds: number;
    }>;
    createPhoto(file: Express.Multer.File, payload: {
        title?: string;
        localityId?: string;
        scope?: string;
    }, user?: RbacUser): Promise<{
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        scope: import("@prisma/client").$Enums.ActivityScope;
        localityId: string | null;
        sortOrder: number;
        createdById: string | null;
        fileUrl: string | null;
        storageKey: string | null;
        mimeType: string | null;
        imageData: string;
    }>;
    updatePhoto(id: string, payload: {
        title?: string;
        sortOrder?: number;
        localityId?: string | null;
        scope?: string;
    }, user?: RbacUser): Promise<{
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        scope: import("@prisma/client").$Enums.ActivityScope;
        localityId: string | null;
        sortOrder: number;
        createdById: string | null;
        fileUrl: string | null;
        storageKey: string | null;
        mimeType: string | null;
        imageData: string;
    }>;
    deletePhoto(id: string, _photosDir: string, user?: RbacUser): Promise<{
        success: boolean;
    }>;
    createDocument(file: Express.Multer.File, payload: {
        title?: string;
        scope?: string;
    }, user?: RbacUser): Promise<{
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        scope: import("@prisma/client").$Enums.ActivityScope;
        fileName: string;
        createdById: string | null;
        fileUrl: string;
        storageKey: string | null;
        mimeType: string | null;
        fileSize: number | null;
    }>;
    updateDocument(id: string, payload: {
        title?: string;
    }, user?: RbacUser): Promise<{
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        scope: import("@prisma/client").$Enums.ActivityScope;
        fileName: string;
        createdById: string | null;
        fileUrl: string;
        storageKey: string | null;
        mimeType: string | null;
        fileSize: number | null;
    }>;
    deleteDocument(id: string, documentsDir: string, user?: RbacUser): Promise<{
        success: boolean;
    }>;
    getDocumentById(id: string): Promise<{
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        scope: import("@prisma/client").$Enums.ActivityScope;
        fileName: string;
        createdById: string | null;
        fileUrl: string;
        storageKey: string | null;
        mimeType: string | null;
        fileSize: number | null;
    }>;
    private parseScope;
    private assertLocalityForScope;
}
export {};
