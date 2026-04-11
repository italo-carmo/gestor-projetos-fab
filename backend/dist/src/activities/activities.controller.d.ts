import type { RbacUser } from '../rbac/rbac.types';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { UpdateActivityStatusDto } from './dto/update-activity-status.dto';
import { UpsertActivityReportDto } from './dto/upsert-activity-report.dto';
import { ActivityCommentDto } from './dto/activity-comment.dto';
import { CreateActivityScheduleItemDto } from './dto/create-activity-schedule-item.dto';
import { UpdateActivityScheduleItemDto } from './dto/update-activity-schedule-item.dto';
import { CreateActivityTypeDto } from './dto/create-activity-type.dto';
import type { Request, Response } from 'express';
export declare class ActivitiesController {
    private readonly activities;
    constructor(activities: ActivitiesService);
    list(localityId: string | undefined, specialtyId: string | undefined, status: string | undefined, scope: string | undefined, q: string | undefined, page: string | undefined, pageSize: string | undefined, user: RbacUser): Promise<{
        items: any[];
        page: number;
        pageSize: number;
        total: number;
    }>;
    create(dto: CreateActivityDto, user: RbacUser): Promise<any>;
    listTypes(): Promise<{
        items: any;
    }>;
    createType(dto: CreateActivityTypeDto): Promise<any>;
    listResponsibleUsers(localityId: string | undefined, specialtyId: string | undefined, user: RbacUser): Promise<{
        items: {
            id: string;
            name: string;
            email: string;
            localityId: string | null;
            specialtyId: string | null;
            eloRoleId: string | null;
        }[];
    }>;
    update(id: string, dto: UpdateActivityDto, user: RbacUser): Promise<any>;
    batchStatus(body: {
        ids: string[];
        status: string;
    }, user: RbacUser): Promise<{
        updated: number;
    }>;
    batchSpecialty(body: {
        ids: string[];
        specialtyId?: string | null;
        specialtyIds?: string[];
    }, user: RbacUser): Promise<{
        updated: number;
    }>;
    batchResponsible(body: {
        ids: string[];
        responsibleUserId: string | null;
    }, user: RbacUser): Promise<{
        updated: number;
    }>;
    batchDelete(body: {
        ids: string[];
    }, user: RbacUser): Promise<{
        deleted: number;
    }>;
    batchReplicate(body: {
        ids: string[];
        targetLocalityIds: string[];
        statusMode?: 'RESET' | 'KEEP';
        dateMode?: 'KEEP' | 'CLEAR' | 'SET_DATE';
        targetDate?: string | null;
    }, user: RbacUser): Promise<{
        created: number;
        skippedSameLocality: number;
        requestedPairs: number;
    }>;
    batchReorder(body: {
        ids: string[];
    }, user: RbacUser): Promise<{
        updated: number;
    }>;
    updateStatus(id: string, dto: UpdateActivityStatusDto, user: RbacUser): Promise<any>;
    remove(id: string, user: RbacUser): Promise<{
        ok: boolean;
    }>;
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
    listSchedule(id: string, user: RbacUser): Promise<{
        activity: {
            id: string;
            title: string;
            eventDate: Date | null;
            locality: any;
            specialty: any;
            specialties: {
                id: string;
                name: string;
                color: string | null;
            }[];
        };
        items: {
            id: any;
            activityId: any;
            title: any;
            startTime: any;
            durationMinutes: any;
            location: any;
            responsible: any;
            participants: any;
            createdAt: any;
            updatedAt: any;
        }[];
    }>;
    createScheduleItem(id: string, dto: CreateActivityScheduleItemDto, user: RbacUser): Promise<{
        id: any;
        activityId: any;
        title: any;
        startTime: any;
        durationMinutes: any;
        location: any;
        responsible: any;
        participants: any;
        createdAt: any;
        updatedAt: any;
    }>;
    updateScheduleItem(id: string, itemId: string, dto: UpdateActivityScheduleItemDto, user: RbacUser): Promise<{
        id: any;
        activityId: any;
        title: any;
        startTime: any;
        durationMinutes: any;
        location: any;
        responsible: any;
        participants: any;
        createdAt: any;
        updatedAt: any;
    }>;
    deleteScheduleItem(id: string, itemId: string, user: RbacUser): Promise<{
        ok: boolean;
    }>;
    exportSchedulePdf(id: string, user: RbacUser, res: Response): Promise<Response<any, Record<string, any>>>;
    upsertReport(id: string, dto: UpsertActivityReportDto, user: RbacUser): Promise<any>;
    signReport(id: string, totpCode: string, user: RbacUser): Promise<{
        activityId: string;
        signedAt: Date | null;
        signedBy: any;
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
