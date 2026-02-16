import type { RbacUser } from '../rbac/rbac.types';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { UpdateActivityStatusDto } from './dto/update-activity-status.dto';
import { UpsertActivityReportDto } from './dto/upsert-activity-report.dto';
import { ActivityCommentDto } from './dto/activity-comment.dto';
import type { Request, Response } from 'express';
export declare class ActivitiesController {
    private readonly activities;
    constructor(activities: ActivitiesService);
    list(localityId: string | undefined, status: string | undefined, q: string | undefined, page: string | undefined, pageSize: string | undefined, user: RbacUser): Promise<{
        items: any[];
        page: number;
        pageSize: number;
        total: number;
    }>;
    create(dto: CreateActivityDto, user: RbacUser): Promise<any>;
    update(id: string, dto: UpdateActivityDto, user: RbacUser): Promise<any>;
    updateStatus(id: string, dto: UpdateActivityStatusDto, user: RbacUser): Promise<any>;
    comments(id: string, user: RbacUser): Promise<{
        items: {
            id: any;
            activityId: any;
            text: any;
            createdAt: any;
            author: {
                id: any;
                name: any;
            } | null;
            authorName: any;
        }[];
        summary: {
            total: number;
            unread: number;
            hasUnread: boolean;
        };
    }>;
    addComment(id: string, dto: ActivityCommentDto, user: RbacUser): Promise<{
        id: any;
        activityId: any;
        text: any;
        createdAt: any;
        author: {
            id: any;
            name: any;
        } | null;
        authorName: any;
    }>;
    markCommentsSeen(id: string, user: RbacUser): Promise<{
        ok: boolean;
        seenAt: Date;
    }>;
    upsertReport(id: string, dto: UpsertActivityReportDto, user: RbacUser): Promise<any>;
    signReport(id: string, user: RbacUser): Promise<{
        activityId: string;
        signedAt: Date | null;
        signedBy: {
            id: string;
            name: string;
            email: string;
        } | null;
        signatureHash: string | null;
        signaturePayloadHash: string | null;
        signatureAlgorithm: string | null;
        signatureVersion: number | null;
    }>;
    uploadPhoto(id: string, file: Express.Multer.File, req: Request & {
        fileValidationError?: string;
    }, user: RbacUser): Promise<{
        id: string;
        createdAt: Date;
        fileName: string;
        fileUrl: string;
        storageKey: string | null;
        mimeType: string | null;
        fileSize: number | null;
        checksum: string | null;
        reportId: string;
    }>;
    removePhoto(id: string, photoId: string, user: RbacUser): Promise<{
        ok: boolean;
    }>;
    exportReportPdf(id: string, user: RbacUser, res: Response): Promise<Response<any, Record<string, any>>>;
    downloadReportFile(filename: string, res: Response): void;
}
