import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RbacUser } from '../rbac/rbac.types';
import { FabLdapService } from '../ldap/fab-ldap.service';
export declare class MissionsService {
    private readonly prisma;
    private readonly audit;
    private readonly fabLdap;
    private readonly missionPdfTimeZone;
    constructor(prisma: PrismaService, audit: AuditService, fabLdap: FabLdapService);
    list(filters: {
        localityId?: string;
        q?: string;
        page?: string;
        pageSize?: string;
    }, user?: RbacUser): Promise<{
        items: {
            participantsCount: number;
            scheduleItemsCount: number;
            locality: {
                id: string;
                name: string;
                code: string;
            };
            participants: {
                id: string;
                name: string;
                email: string | null;
                ldapUid: string | null;
                userId: string | null;
                fabom: string | null;
                cpf: string | null;
            }[];
            scheduleItems: {
                id: string;
            }[];
            id: string;
            title: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            localityId: string;
            createdById: string | null;
            startDate: Date;
            endDate: Date;
        }[];
        page: number;
        pageSize: number;
        total: number;
    }>;
    getStatistics(user?: RbacUser): Promise<{
        totalMissions: number;
        totalParticipants: number;
        totalMissionDays: number;
        totalParticipantDays: number;
        missionsByUser: {
            userId: string;
            userName: string;
            userEmail: string;
            count: number;
            totalDays: number;
        }[];
        usersByMissionDays: {
            userId: string;
            userName: string;
            userEmail: string;
            count: number;
            totalDays: number;
        }[];
        participantsByMission: {
            missionId: string;
            missionTitle: string;
            participantsCount: number;
            missionDays: number;
        }[];
        averageParticipantsPerMission: number;
        averageMissionDays: number;
        missionsWithoutParticipants: number;
        missionsWithMostParticipants: {
            missionId: string;
            missionTitle: string;
            participantsCount: number;
        }[];
    }>;
    getById(id: string, user?: RbacUser): Promise<{
        locality: {
            id: string;
            name: string;
            code: string;
        };
        participants: ({
            user: {
                id: string;
                name: string;
                email: string;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            name: string;
            email: string | null;
            ldapUid: string | null;
            userId: string | null;
            fabom: string | null;
            missionId: string;
            cpf: string | null;
        })[];
        scheduleItems: {
            id: string;
            title: string;
            createdAt: Date;
            updatedAt: Date;
            location: string;
            participants: string;
            responsible: string;
            durationMinutes: number;
            missionId: string;
            startAt: Date;
        }[];
    } & {
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        localityId: string;
        createdById: string | null;
        startDate: Date;
        endDate: Date;
    }>;
    create(payload: {
        title: string;
        description?: string | null;
        localityId: string;
        startDate: string;
        endDate: string;
    }, user?: RbacUser): Promise<{
        participantsCount: number;
        scheduleItemsCount: number;
        locality: {
            id: string;
            name: string;
            code: string;
        };
        participants: {
            id: string;
            createdAt: Date;
            name: string;
            email: string | null;
            ldapUid: string | null;
            userId: string | null;
            fabom: string | null;
            missionId: string;
            cpf: string | null;
        }[];
        scheduleItems: {
            id: string;
            title: string;
            createdAt: Date;
            updatedAt: Date;
            location: string;
            participants: string;
            responsible: string;
            durationMinutes: number;
            missionId: string;
            startAt: Date;
        }[];
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        localityId: string;
        createdById: string | null;
        startDate: Date;
        endDate: Date;
    }>;
    update(id: string, payload: {
        title?: string;
        description?: string | null;
        localityId?: string;
        startDate?: string;
        endDate?: string;
    }, user?: RbacUser): Promise<{
        participantsCount: number;
        scheduleItemsCount: number;
        locality: {
            id: string;
            name: string;
            code: string;
        };
        participants: {
            id: string;
            createdAt: Date;
            name: string;
            email: string | null;
            ldapUid: string | null;
            userId: string | null;
            fabom: string | null;
            missionId: string;
            cpf: string | null;
        }[];
        scheduleItems: {
            id: string;
            title: string;
            createdAt: Date;
            updatedAt: Date;
            location: string;
            participants: string;
            responsible: string;
            durationMinutes: number;
            missionId: string;
            startAt: Date;
        }[];
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        localityId: string;
        createdById: string | null;
        startDate: Date;
        endDate: Date;
    }>;
    delete(id: string, user?: RbacUser): Promise<{
        ok: boolean;
    }>;
    lookupLdapParticipant(rawQuery: string | undefined, user?: RbacUser): Promise<{
        item: null;
    } | {
        item: {
            uid: string;
            name: string | null;
            email: string | null;
            fabom: string | null;
            cpf: string | null;
        };
    }>;
    addParticipantFromLdap(missionId: string, identifier: string, user?: RbacUser): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        email: string | null;
        ldapUid: string | null;
        userId: string | null;
        fabom: string | null;
        missionId: string;
        cpf: string | null;
    }>;
    addParticipantFromUser(missionId: string, userId: string, user?: RbacUser): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        email: string | null;
        ldapUid: string | null;
        userId: string | null;
        fabom: string | null;
        missionId: string;
        cpf: string | null;
    }>;
    removeParticipant(missionId: string, participantId: string, user?: RbacUser): Promise<{
        ok: boolean;
    }>;
    listSchedule(missionId: string, user?: RbacUser): Promise<{
        mission: {
            id: string;
            title: string;
            description: string | null;
            startDate: Date;
            endDate: Date;
            locality: {
                id: string;
                name: string;
                code: string;
            };
        };
        items: {
            id: string;
            title: string;
            createdAt: Date;
            updatedAt: Date;
            location: string;
            participants: string;
            responsible: string;
            durationMinutes: number;
            missionId: string;
            startAt: Date;
        }[];
    }>;
    createScheduleItem(missionId: string, payload: {
        title: string;
        startAt: string;
        durationMinutes: number;
        location: string;
        responsible: string;
        participants: string;
    }, user?: RbacUser): Promise<{
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        location: string;
        participants: string;
        responsible: string;
        durationMinutes: number;
        missionId: string;
        startAt: Date;
    }>;
    updateScheduleItem(missionId: string, itemId: string, payload: {
        title?: string;
        startAt?: string;
        durationMinutes?: number;
        location?: string;
        responsible?: string;
        participants?: string;
    }, user?: RbacUser): Promise<{
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        location: string;
        participants: string;
        responsible: string;
        durationMinutes: number;
        missionId: string;
        startAt: Date;
    }>;
    deleteScheduleItem(missionId: string, itemId: string, user?: RbacUser): Promise<{
        ok: boolean;
    }>;
    buildSchedulePdf(missionId: string, user?: RbacUser): Promise<{
        fileName: string;
        buffer: Buffer<ArrayBufferLike>;
    }>;
    private assertMissionAccess;
    private getTargetLocalityIds;
    private sanitizeRequiredText;
    private parseRequiredDate;
    private normalizeDurationMinutes;
    private findScheduleLogoPath;
    private getWeekStartDate;
    private formatDateNoYear;
    private formatWeekdayDate;
    private formatDuration;
    private formatDate;
    private formatTime;
    private getDateTimePartsInTimeZone;
    private removeOmFromParticipantName;
    private extractCpf;
    private calculateInclusiveDays;
}
