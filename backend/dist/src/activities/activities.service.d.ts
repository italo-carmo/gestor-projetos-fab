import { ActivityStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RbacUser } from '../rbac/rbac.types';
export declare class ActivitiesService {
    private readonly prisma;
    private readonly audit;
    private readonly config;
    constructor(prisma: PrismaService, audit: AuditService, config: ConfigService);
    list(filters: {
        localityId?: string;
        status?: string;
        q?: string;
        page?: string;
        pageSize?: string;
    }, user?: RbacUser): Promise<{
        items: any[];
        page: number;
        pageSize: number;
        total: number;
    }>;
    create(payload: {
        title: string;
        description?: string | null;
        localityId?: string | null;
        eventDate?: string | null;
        reportRequired?: boolean;
    }, user?: RbacUser): Promise<any>;
    update(id: string, payload: {
        title?: string;
        description?: string | null;
        localityId?: string | null;
        eventDate?: string | null;
        reportRequired?: boolean;
    }, user?: RbacUser): Promise<any>;
    updateStatus(id: string, status: ActivityStatus, user?: RbacUser): Promise<any>;
    listComments(id: string, user?: RbacUser): Promise<{
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
    addComment(id: string, text: string, user?: RbacUser): Promise<{
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
    markCommentsSeen(id: string, user?: RbacUser): Promise<{
        ok: boolean;
        seenAt: Date;
    }>;
    listSchedule(activityId: string, user?: RbacUser): Promise<{
        activity: {
            id: string;
            title: string;
            eventDate: Date | null;
            locality: {
                id: string;
                name: string;
                code: string;
            } | null;
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
    createScheduleItem(activityId: string, payload: {
        title: string;
        startTime: string;
        durationMinutes: number;
        location: string;
        responsible: string;
        participants: string;
    }, user?: RbacUser): Promise<{
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
    updateScheduleItem(activityId: string, itemId: string, payload: {
        title?: string;
        startTime?: string;
        durationMinutes?: number;
        location?: string;
        responsible?: string;
        participants?: string;
    }, user?: RbacUser): Promise<{
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
    deleteScheduleItem(activityId: string, itemId: string, user?: RbacUser): Promise<{
        ok: boolean;
    }>;
    buildSchedulePdf(activityId: string, user?: RbacUser): Promise<{
        fileName: string;
        buffer: Buffer<ArrayBufferLike>;
    }>;
    upsertReport(activityId: string, payload: {
        date: string;
        location: string;
        responsible: string;
        missionSupport: string;
        introduction: string;
        missionObjectives: string;
        executionSchedule: string;
        activitiesPerformed: string;
        participantsCount: number;
        participantsCharacteristics: string;
        conclusion: string;
        city: string;
        closingDate: string;
    }, user?: RbacUser): Promise<any>;
    addReportPhoto(activityId: string, file: {
        fileName: string;
        fileUrl: string;
        storageKey?: string | null;
        mimeType?: string | null;
        fileSize?: number | null;
        checksum?: string | null;
    }, user?: RbacUser): Promise<{
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
    removeReportPhoto(activityId: string, photoId: string, user?: RbacUser): Promise<{
        ok: boolean;
    }>;
    signReport(activityId: string, user?: RbacUser): Promise<{
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
    buildReportPdf(activityId: string, user?: RbacUser): Promise<{
        fileName: string;
        buffer: Buffer<ArrayBufferLike>;
    }>;
    private attachActivityCommentSummary;
    private mapActivity;
    private mapComment;
    private mapScheduleItem;
    private normalizeScheduleTime;
    private normalizeDurationMinutes;
    private findScheduleLogoPath;
    private formatDuration;
    private sanitizeRequiredText;
    private sanitizeCommentText;
    private assertLocalityConstraint;
    private invalidateSignature;
    private formatDate;
    private formatDateTime;
}
