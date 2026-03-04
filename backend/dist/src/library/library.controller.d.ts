import type { RbacUser } from '../rbac/rbac.types';
import { LibraryService } from './library.service';
export declare const libraryPhotosDir: string;
export declare const libraryDocumentsDir: string;
export declare class LibraryController {
    private readonly library;
    constructor(library: LibraryService);
    list(): Promise<{
        photos: any;
        documents: any;
        settings: {
            carouselIntervalSeconds: number;
        };
    }>;
    updateSettings(body: {
        carouselIntervalSeconds: number;
    }, user: RbacUser): Promise<any>;
    uploadPhoto(file: Express.Multer.File, body: {
        title?: string;
    }, user: RbacUser): Promise<any>;
    updatePhoto(id: string, body: {
        title?: string;
        sortOrder?: number;
    }, user: RbacUser): Promise<any>;
    deletePhoto(id: string, user: RbacUser): Promise<{
        success: boolean;
    }>;
    uploadDocument(file: Express.Multer.File, body: {
        title?: string;
    }, user: RbacUser): Promise<any>;
    updateDocument(id: string, body: {
        title?: string;
    }, user: RbacUser): Promise<any>;
    deleteDocument(id: string, user: RbacUser): Promise<{
        success: boolean;
    }>;
}
