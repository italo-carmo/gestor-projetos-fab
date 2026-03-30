import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { RbacUser } from '../rbac/rbac.types';
export declare class LibraryService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    getData(): Promise<{
        photos: ({
            locality: {
                id: string;
                name: string;
                code: string;
            } | null;
        } & {
            id: string;
            title: string;
            createdAt: Date;
            updatedAt: Date;
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
            fileName: string;
            createdById: string | null;
            fileUrl: string;
            storageKey: string | null;
            mimeType: string | null;
            fileSize: number | null;
        }[];
        settings: {
            carouselIntervalSeconds: number;
        };
    }>;
    ensureEditorAccess(user?: RbacUser): void;
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
    }, user?: RbacUser): Promise<{
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
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
    }, user?: RbacUser): Promise<{
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
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
    }, user?: RbacUser): Promise<{
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
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
        fileName: string;
        createdById: string | null;
        fileUrl: string;
        storageKey: string | null;
        mimeType: string | null;
        fileSize: number | null;
    }>;
}
