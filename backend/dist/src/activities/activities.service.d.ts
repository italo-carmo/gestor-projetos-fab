import { ActivityScope, ActivityStatus } from '@prisma/client';
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
        specialtyId?: string;
        status?: string;
        scope?: string;
        q?: string;
        page?: string;
        pageSize?: string;
    }, user?: RbacUser): Promise<{
        items: any[];
        page: number;
        pageSize: number;
        total: number;
    }>;
    getById(id: string, user?: RbacUser): Promise<any>;
    listResponsibleUsers(filters: {
        localityId?: string;
        specialtyId?: string;
    }, user?: RbacUser): Promise<{
        items: {
            id: string;
            name: string;
            email: string;
            localityId: string | null;
            specialtyId: string | null;
            eloRoleId: string | null;
        }[];
    }>;
    create(payload: {
        title: string;
        description?: string | null;
        localityId?: string | null;
        localityIds?: string[];
        activityTypeId?: string | null;
        specialtyId?: string | null;
        specialtyIds?: string[];
        eventDate?: string | null;
        reportRequired?: boolean;
        responsibleUserIds?: string[];
        scope?: ActivityScope;
    }, user?: RbacUser): Promise<any>;
    update(id: string, payload: {
        title?: string;
        description?: string | null;
        localityId?: string | null;
        activityTypeId?: string | null;
        specialtyId?: string | null;
        specialtyIds?: string[];
        eventDate?: string | null;
        reportRequired?: boolean;
        responsibleUserIds?: string[];
    }, user?: RbacUser): Promise<any>;
    updateStatus(id: string, status: ActivityStatus, user?: RbacUser): Promise<any>;
    delete(id: string, user?: RbacUser): Promise<{
        ok: boolean;
    }>;
    batchUpdateStatus(ids: string[], status: ActivityStatus, user?: RbacUser): Promise<{
        updated: number;
    }>;
    batchUpdateSpecialty(ids: string[], specialtyIdsInput: string[], user?: RbacUser): Promise<{
        updated: number;
    }>;
    batchUpdateResponsible(ids: string[], responsibleUserId: string | null, user?: RbacUser): Promise<{
        updated: number;
    }>;
    batchDelete(ids: string[], user?: RbacUser): Promise<{
        deleted: number;
    }>;
    batchReplicate(ids: string[], targetLocalityIds: string[], options?: {
        statusMode?: 'RESET' | 'KEEP';
        dateMode?: 'KEEP' | 'CLEAR' | 'SET_DATE';
        targetDate?: string | null;
    }, user?: RbacUser): Promise<{
        created: number;
        skippedSameLocality: number;
        requestedPairs: number;
    }>;
    batchReorder(ids: string[], user?: RbacUser): Promise<{
        updated: number;
    }>;
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
        activityAnalysis: string;
        missionSupport?: string;
        introduction?: string;
        missionObjectives?: string;
        executionSchedule?: string;
        activitiesPerformed: string;
        participantsCount: number;
        participantsMaleCount?: number;
        participantsFemaleCount?: number;
        publicProfile?: string;
        instructorsCount: number;
        recruitsCount: number;
        eloPsychologyCount: number;
        eloSocialAssistanceCount: number;
        eloJuridicoCount: number;
        eloCpcaCount: number;
        eloGraduadoMasterCount: number;
        participantsCharacteristics: string;
        mainPointsObserved?: string;
        attentionPoints?: string;
        nextSteps?: string;
        referencesAndAttachments?: string;
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
    signReport(activityId: string, user?: RbacUser, totpCode?: string): Promise<{
        activityId: string;
        signedAt: Date | null;
        signedBy: any;
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
    private mapActivitySpecialties;
    private extractActivitySpecialtyIds;
    private formatActivitySpecialtiesLabel;
    listTypes(): Promise<{
        items: any;
    }>;
    createType(name: string): Promise<any>;
    private mapComment;
    private mapScheduleItem;
    private normalizeScheduleTime;
    private normalizeDurationMinutes;
    private findScheduleLogoPath;
    private formatDuration;
    private sanitizeRequiredText;
    private sanitizeCommentText;
    private normalizeActivityIds;
    private getTargetLocalityIds;
    private getScopeConstraints;
    private assertScopeConstraint;
    private buildActivityAccessWhere;
    private isActivityResponsible;
    private hasActivityGroupMatch;
    private assertActivityViewAccess;
    private assertActivityOperateAccess;
    private assertDeleteAccess;
    private resolveActivitySpecialtyIds;
    private resolveActivityResponsibleIds;
    private resolveActivityTypeId;
    private invalidateSignature;
    private formatDate;
    private formatDateTime;
}
