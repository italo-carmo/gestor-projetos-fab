import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { RbacUser } from '../rbac/rbac.types';
export declare class LibraryService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    getData(): Promise<{
        photos: any;
        documents: any;
        settings: {
            carouselIntervalSeconds: number;
        };
    }>;
    ensureEditorAccess(user?: RbacUser): void;
    updateSettings(payload: {
        carouselIntervalSeconds: number;
    }, user?: RbacUser): Promise<any>;
    createPhoto(file: Express.Multer.File, payload: {
        title?: string;
    }, user?: RbacUser): Promise<any>;
    updatePhoto(id: string, payload: {
        title?: string;
        sortOrder?: number;
    }, user?: RbacUser): Promise<any>;
    deletePhoto(id: string, photosDir: string, user?: RbacUser): Promise<{
        success: boolean;
    }>;
    createDocument(file: Express.Multer.File, payload: {
        title?: string;
    }, user?: RbacUser): Promise<any>;
    updateDocument(id: string, payload: {
        title?: string;
    }, user?: RbacUser): Promise<any>;
    deleteDocument(id: string, documentsDir: string, user?: RbacUser): Promise<{
        success: boolean;
    }>;
}
