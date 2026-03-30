import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RbacUser } from '../rbac/rbac.types';
import { FabLdapService } from '../ldap/fab-ldap.service';
import { type MissionChecklistSectionId, type MissionChecklistClassification } from './mission-checklist.constants';
type MissionChecklistSectionRuntime = {
    id: MissionChecklistSectionId;
    title: string;
    items: Array<{
        id: string;
        title: string;
        prompt: string | null;
        sortOrder: number;
    }>;
};
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
            checklistJson: Prisma.JsonValue | null;
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
    getChecklistMapping(filters: {
        localityId?: string;
    }, user?: RbacUser): Promise<{
        generatedAt: string;
        localities: {
            id: string;
            name: string;
            code: string | null;
        }[];
        classifications: {
            id: MissionChecklistClassification;
            label: string;
            colorHex: string | null;
            sortOrder: number;
        }[];
        defaultClassification: "FORTE_CONSOLIDADA" | "OPORTUNIDADE_MELHORIA" | "NECESSITA_ANALISE" | "POSSIVEL_RISCO";
        sections: {
            id: "lideranca" | "acompanhamento_recrutas" | "analise_riscos";
            title: string;
            items: {
                id: string;
                title: string;
                prompt: string | null;
                cells: ({
                    localityId: string;
                    missionId: null;
                    classification: null;
                    notes: string;
                    hasNotes: boolean;
                    photos: never[];
                    hasPhotos: boolean;
                } | {
                    localityId: string;
                    missionId: string;
                    classification: null;
                    notes: string;
                    hasNotes: boolean;
                    photos: never[];
                    hasPhotos: boolean;
                } | {
                    localityId: string;
                    missionId: string;
                    classification: "FORTE_CONSOLIDADA" | "OPORTUNIDADE_MELHORIA" | "NECESSITA_ANALISE" | "POSSIVEL_RISCO";
                    notes: string;
                    hasNotes: boolean;
                    photos: string[];
                    hasPhotos: boolean;
                })[];
            }[];
        }[];
        missionsByLocality: ({
            localityId: string;
            mission: null;
        } | {
            localityId: string;
            mission: {
                id: string;
                title: string;
                description: string | null;
                startDate: Date;
                endDate: Date;
                updatedAt: Date;
                locality: {
                    id: string;
                    name: string;
                    code: string;
                };
                checklistOm: {
                    id: string;
                    name: string;
                    code: string | null;
                };
                participants: {
                    id: string;
                    name: string;
                    email: string | null;
                    ldapUid: string | null;
                    fabom: string | null;
                    cpf: string | null;
                }[];
                participantsCount: number;
                scheduleItems: {
                    id: string;
                    title: string;
                    location: string;
                    participants: string;
                    responsible: string;
                    durationMinutes: number;
                    startAt: Date;
                }[];
                scheduleItemsCount: number;
                checklistSections: MissionChecklistSectionRuntime[];
            };
        })[];
    }>;
    getChecklistConfig(user?: RbacUser): Promise<{
        generatedAt: string;
        classifications: {
            id: MissionChecklistClassification;
            label: string;
            colorHex: string | null;
            sortOrder: number;
        }[];
        defaultClassification: "FORTE_CONSOLIDADA" | "OPORTUNIDADE_MELHORIA" | "NECESSITA_ANALISE" | "POSSIVEL_RISCO";
        sections: MissionChecklistSectionRuntime[];
    }>;
    createChecklistDimension(payload: {
        sectionId: MissionChecklistSectionId;
        title: string;
        prompt?: string;
        sortOrder?: number;
    }, user?: RbacUser): Promise<{
        id: string;
        sectionId: string;
        title: string;
        prompt: string | null;
        sortOrder: number;
    }>;
    updateChecklistDimension(id: string, payload: {
        sectionId?: MissionChecklistSectionId;
        title?: string;
        prompt?: string;
        sortOrder?: number;
    }, user?: RbacUser): Promise<{
        id: string;
        sectionId: string;
        title: string;
        prompt: string | null;
        sortOrder: number;
    }>;
    deleteChecklistDimension(id: string, user?: RbacUser): Promise<{
        ok: boolean;
    }>;
    updateChecklistClassification(id: string, payload: {
        label: string;
        colorHex?: string;
    }, user?: RbacUser): Promise<{
        id: string;
        label: string;
        colorHex: string | null;
        sortOrder: number;
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
        checklistJson: Prisma.JsonValue | null;
        startDate: Date;
        endDate: Date;
    }>;
    getChecklist(id: string, user?: RbacUser): Promise<{
        missionId: string;
        localityId: string;
        omId: string;
        om: "" | {
            id: string;
            name: string;
            code: string;
        } | null;
        updatedAt: Date;
        classifications: {
            id: MissionChecklistClassification;
            label: string;
            colorHex: string | null;
            sortOrder: number;
        }[];
        defaultClassification: "FORTE_CONSOLIDADA" | "OPORTUNIDADE_MELHORIA" | "NECESSITA_ANALISE" | "POSSIVEL_RISCO";
        sections: {
            id: "lideranca" | "acompanhamento_recrutas" | "analise_riscos";
            title: string;
            items: {
                id: string;
                title: string;
                prompt: string | null;
                sortOrder: number;
                classification: "FORTE_CONSOLIDADA" | "OPORTUNIDADE_MELHORIA" | "NECESSITA_ANALISE" | "POSSIVEL_RISCO";
                notes: string;
                photos: string[];
            }[];
        }[];
    }>;
    upsertChecklist(id: string, payload: {
        omId: string;
        items: {
            id: string;
            classification: MissionChecklistClassification;
            notes?: string;
            photos?: string[];
        }[];
    }, user?: RbacUser): Promise<{
        missionId: string;
        localityId: string;
        omId: string;
        updatedAt: Date;
        classifications: {
            id: MissionChecklistClassification;
            label: string;
            colorHex: string | null;
            sortOrder: number;
        }[];
        defaultClassification: "FORTE_CONSOLIDADA" | "OPORTUNIDADE_MELHORIA" | "NECESSITA_ANALISE" | "POSSIVEL_RISCO";
        sections: {
            id: "lideranca" | "acompanhamento_recrutas" | "analise_riscos";
            title: string;
            items: {
                id: string;
                title: string;
                prompt: string | null;
                sortOrder: number;
                classification: "FORTE_CONSOLIDADA" | "OPORTUNIDADE_MELHORIA" | "NECESSITA_ANALISE" | "POSSIVEL_RISCO";
                notes: string;
                photos: string[];
            }[];
        }[];
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
        checklistJson: Prisma.JsonValue | null;
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
        checklistJson: Prisma.JsonValue | null;
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
    private buildMissionChecklistSections;
    private normalizeMissionChecklistItems;
    private readStoredMissionChecklistItems;
    private normalizeMissionChecklistPhotos;
    private getMissionChecklistConfig;
    private readStoredMissionChecklistOmId;
    private isMissionChecklistClassification;
    private isMissionChecklistSectionId;
    private normalizeChecklistSectionId;
    private nextChecklistDimensionSortOrder;
    private normalizeHexColor;
    private sanitizeHexColorOrNull;
    private isJsonObject;
    private assertMissionAccess;
    private assertMissionChecklistEditAccess;
    assertChecklistUploadAccess(id: string, user?: RbacUser): Promise<void>;
    private assertMissionChecklistConfigAccess;
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
export {};
