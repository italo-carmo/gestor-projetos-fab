import type { RbacUser } from '../rbac/rbac.types';
import { MissionsService } from './missions.service';
import { CreateMissionDto } from './dto/create-mission.dto';
import { UpdateMissionDto } from './dto/update-mission.dto';
import { CreateMissionScheduleItemDto } from './dto/create-mission-schedule-item.dto';
import { UpdateMissionScheduleItemDto } from './dto/update-mission-schedule-item.dto';
import { MissionLdapParticipantDto } from './dto/mission-ldap-participant.dto';
import { MissionUserParticipantDto } from './dto/mission-user-participant.dto';
import { UpsertMissionChecklistDto } from './dto/upsert-mission-checklist.dto';
import { CreateMissionChecklistDimensionDto } from './dto/create-mission-checklist-dimension.dto';
import { UpdateMissionChecklistDimensionDto } from './dto/update-mission-checklist-dimension.dto';
import { UpdateMissionChecklistClassificationDto } from './dto/update-mission-checklist-classification.dto';
import type { Response } from 'express';
export declare class MissionsController {
    private readonly missions;
    constructor(missions: MissionsService);
    list(localityId: string | undefined, q: string | undefined, page: string | undefined, pageSize: string | undefined, scope: string | undefined, user: RbacUser): Promise<{
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
            checklistJson: import("@prisma/client/runtime/client").JsonValue | null;
            startDate: Date;
            endDate: Date;
        }[];
        page: number;
        pageSize: number;
        total: number;
    }>;
    getStatistics(scope: string | undefined, user: RbacUser): Promise<{
        totalMissions: number;
        totalParticipants: any;
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
            participantsCount: any;
            missionDays: number;
        }[];
        averageParticipantsPerMission: number;
        averageMissionDays: number;
        missionsWithoutParticipants: number;
        missionsWithMostParticipants: {
            missionId: string;
            missionTitle: string;
            participantsCount: any;
        }[];
    }>;
    listLocalityOptions(scope: string | undefined, user: RbacUser): Promise<{
        items: {
            id: string;
            code: string | null;
            name: string;
        }[];
    }>;
    getChecklistMapping(localityId: string | undefined, scope: string | undefined, user: RbacUser): Promise<{
        generatedAt: string;
        localities: {
            id: string;
            name: string;
            code: string | null;
        }[];
        classifications: {
            id: import("./mission-checklist.constants").MissionChecklistClassification;
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
                locality: any;
                checklistOm: {
                    id: string;
                    name: string;
                    code: string | null;
                };
                participants: any;
                participantsCount: any;
                scheduleItems: any;
                scheduleItemsCount: any;
                checklistSections: {
                    id: import("./mission-checklist.constants").MissionChecklistSectionId;
                    title: string;
                    items: Array<{
                        id: string;
                        title: string;
                        prompt: string | null;
                        sortOrder: number;
                    }>;
                }[];
            };
        })[];
    }>;
    getChecklistConfig(user: RbacUser): Promise<{
        generatedAt: string;
        classifications: {
            id: import("./mission-checklist.constants").MissionChecklistClassification;
            label: string;
            colorHex: string | null;
            sortOrder: number;
        }[];
        defaultClassification: "FORTE_CONSOLIDADA" | "OPORTUNIDADE_MELHORIA" | "NECESSITA_ANALISE" | "POSSIVEL_RISCO";
        sections: {
            id: import("./mission-checklist.constants").MissionChecklistSectionId;
            title: string;
            items: Array<{
                id: string;
                title: string;
                prompt: string | null;
                sortOrder: number;
            }>;
        }[];
    }>;
    createChecklistDimension(dto: CreateMissionChecklistDimensionDto, user: RbacUser): Promise<{
        id: string;
        sectionId: string;
        title: string;
        prompt: string | null;
        sortOrder: number;
    }>;
    updateChecklistDimension(id: string, dto: UpdateMissionChecklistDimensionDto, user: RbacUser): Promise<{
        id: string;
        sectionId: string;
        title: string;
        prompt: string | null;
        sortOrder: number;
    }>;
    deleteChecklistDimension(id: string, user: RbacUser): Promise<{
        ok: boolean;
    }>;
    updateChecklistClassification(id: string, dto: UpdateMissionChecklistClassificationDto, user: RbacUser): Promise<{
        id: string;
        label: string;
        colorHex: string | null;
        sortOrder: number;
    }>;
    create(dto: CreateMissionDto, user: RbacUser): Promise<{
        participantsCount: any;
        scheduleItemsCount: any;
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        localityId: string;
        createdById: string | null;
        checklistJson: import("@prisma/client/runtime/client").JsonValue | null;
        startDate: Date;
        endDate: Date;
    }>;
    update(id: string, dto: UpdateMissionDto, user: RbacUser): Promise<{
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
        checklistJson: import("@prisma/client/runtime/client").JsonValue | null;
        startDate: Date;
        endDate: Date;
    }>;
    remove(id: string, user: RbacUser): Promise<{
        ok: boolean;
    }>;
    lookupLdapParticipant(q: string | undefined, user: RbacUser): Promise<{
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
    getById(id: string, user: RbacUser): Promise<{
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
        checklistJson: import("@prisma/client/runtime/client").JsonValue | null;
        startDate: Date;
        endDate: Date;
    }>;
    getChecklist(id: string, user: RbacUser): Promise<{
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
            id: import("./mission-checklist.constants").MissionChecklistClassification;
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
    upsertChecklist(id: string, dto: UpsertMissionChecklistDto, user: RbacUser): Promise<{
        missionId: string;
        localityId: string;
        omId: string;
        updatedAt: Date;
        classifications: {
            id: import("./mission-checklist.constants").MissionChecklistClassification;
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
    uploadChecklistPhoto(id: string, file: Express.Multer.File, user: RbacUser): Promise<{
        photoUrl: string;
    }>;
    addParticipantFromLdap(id: string, dto: MissionLdapParticipantDto, user: RbacUser): Promise<{
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
    addParticipantFromUser(id: string, dto: MissionUserParticipantDto, user: RbacUser): Promise<{
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
    removeParticipant(id: string, participantId: string, user: RbacUser): Promise<{
        ok: boolean;
    }>;
    listSchedule(id: string, user: RbacUser): Promise<{
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
    createScheduleItem(id: string, dto: CreateMissionScheduleItemDto, user: RbacUser): Promise<{
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
    updateScheduleItem(id: string, itemId: string, dto: UpdateMissionScheduleItemDto, user: RbacUser): Promise<{
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
    deleteScheduleItem(id: string, itemId: string, user: RbacUser): Promise<{
        ok: boolean;
    }>;
    exportSchedulePdf(id: string, user: RbacUser, res: Response): Promise<Response<any, Record<string, any>>>;
}
export declare class MissionsChecklistUploadsController {
    uploadedPhoto(filename: string, res: Response): Promise<void>;
}
