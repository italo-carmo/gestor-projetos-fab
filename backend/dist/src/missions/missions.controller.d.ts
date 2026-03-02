import type { RbacUser } from '../rbac/rbac.types';
import { MissionsService } from './missions.service';
import { CreateMissionDto } from './dto/create-mission.dto';
import { UpdateMissionDto } from './dto/update-mission.dto';
import { CreateMissionScheduleItemDto } from './dto/create-mission-schedule-item.dto';
import { UpdateMissionScheduleItemDto } from './dto/update-mission-schedule-item.dto';
import { MissionLdapParticipantDto } from './dto/mission-ldap-participant.dto';
import { MissionUserParticipantDto } from './dto/mission-user-participant.dto';
import type { Response } from 'express';
export declare class MissionsController {
    private readonly missions;
    constructor(missions: MissionsService);
    list(localityId: string | undefined, q: string | undefined, page: string | undefined, pageSize: string | undefined, user: RbacUser): Promise<{
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
    getStatistics(user: RbacUser): Promise<{
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
    create(dto: CreateMissionDto, user: RbacUser): Promise<{
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
        startDate: Date;
        endDate: Date;
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
