import type { Response } from 'express';
import type { RbacUser } from '../rbac/rbac.types';
import { LibraryService } from './library.service';
export declare const libraryPhotosDir: string;
export declare const libraryDocumentsDir: string;
export declare class LibraryController {
    private readonly library;
    constructor(library: LibraryService);
    list(): Promise<{
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
    updateSettings(body: {
        carouselIntervalSeconds: number;
    }, user: RbacUser): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        carouselIntervalSeconds: number;
    }>;
    uploadPhoto(file: Express.Multer.File, body: {
        title?: string;
        localityId?: string;
    }, user: RbacUser): Promise<{
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
    updatePhoto(id: string, body: {
        title?: string;
        sortOrder?: number;
        localityId?: string | null;
    }, user: RbacUser): Promise<{
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
    deletePhoto(id: string, user: RbacUser): Promise<{
        success: boolean;
    }>;
    uploadDocument(file: Express.Multer.File, body: {
        title?: string;
    }, user: RbacUser): Promise<{
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
    updateDocument(id: string, body: {
        title?: string;
    }, user: RbacUser): Promise<{
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
    deleteDocument(id: string, user: RbacUser): Promise<{
        success: boolean;
    }>;
    downloadDocument(id: string, res: Response): Promise<void | Response<any, Record<string, any>>>;
}
