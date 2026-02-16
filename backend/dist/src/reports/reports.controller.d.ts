import type { Request, Response } from 'express';
import type { RbacUser } from '../rbac/rbac.types';
import { ReportsService } from './reports.service';
export declare class ReportsController {
    private readonly reports;
    constructor(reports: ReportsService);
    upload(file: Express.Multer.File, taskInstanceId: string, req: Request & {
        fileValidationError?: string;
    }, user: RbacUser): Promise<{
        id: string;
        createdAt: Date;
        taskInstanceId: string;
        fileName: string;
        fileUrl: string;
        storageKey: string | null;
        mimeType: string | null;
        fileSize: number | null;
        checksum: string | null;
        approved: boolean;
    }>;
    download(id: string, token: string | undefined, res: Response, user: RbacUser): Promise<void | Response<any, Record<string, any>>>;
    signedUrl(id: string, user: RbacUser): Promise<{
        url: string;
        expiresIn: string;
    }>;
    approve(id: string, approved: boolean, user: RbacUser): Promise<{
        id: string;
        createdAt: Date;
        taskInstanceId: string;
        fileName: string;
        fileUrl: string;
        storageKey: string | null;
        mimeType: string | null;
        fileSize: number | null;
        checksum: string | null;
        approved: boolean;
    }>;
}
