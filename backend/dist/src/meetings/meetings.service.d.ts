import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { AuditService } from '../audit/audit.service';
import { RbacUser } from '../rbac/rbac.types';
export declare class MeetingsService {
    private readonly prisma;
    private readonly tasks;
    private readonly audit;
    constructor(prisma: PrismaService, tasks: TasksService, audit: AuditService);
    list(filters: {
        status?: string;
        scope?: string;
        localityId?: string;
        from?: string;
        to?: string;
        page?: string;
        pageSize?: string;
    }, user?: RbacUser): Promise<{
        items: ({
            locality: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                code: string;
                commandName: string | null;
                commanderName: string | null;
                individualMeetingDate: Date | null;
                visitDate: Date | null;
                recruitsFemaleCountCurrent: number | null;
                notes: string | null;
            } | null;
            participants: ({
                user: {
                    id: string;
                    name: string;
                    email: string;
                };
            } & {
                id: string;
                userId: string;
                meetingId: string;
            })[];
            tasks: ({
                taskTemplate: {
                    id: string;
                    title: string;
                    phaseId: string;
                    specialtyId: string | null;
                    eloRoleId: string | null;
                    createdAt: Date;
                    updatedAt: Date;
                    description: string | null;
                    appliesToAllLocalities: boolean;
                    reportRequiredDefault: boolean;
                };
            } & {
                id: string;
                eloRoleId: string | null;
                createdAt: Date;
                updatedAt: Date;
                taskTemplateId: string;
                localityId: string;
                status: import("@prisma/client").$Enums.TaskStatus;
                reportRequired: boolean;
                dueDate: Date;
                priority: import("@prisma/client").$Enums.TaskPriority;
                progressPercent: number;
                assigneeType: import("@prisma/client").$Enums.TaskAssigneeType | null;
                externalAssigneeName: string | null;
                externalAssigneeRole: string | null;
                blockedByIdsJson: Prisma.JsonValue | null;
                meetingId: string | null;
                assignedToId: string | null;
                assignedEloId: string | null;
            })[];
            decisions: {
                id: string;
                createdAt: Date;
                meetingId: string;
                text: string;
            }[];
        } & {
            datetime: Date;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            scope: string;
            localityId: string | null;
            status: import("@prisma/client").$Enums.MeetingStatus;
            meetingType: import("@prisma/client").$Enums.MeetingType;
            meetingLink: string | null;
            agenda: string | null;
            participantsJson: Prisma.JsonValue | null;
        })[];
        page: number;
        pageSize: number;
        total: number;
    }>;
    create(payload: {
        datetime: string;
        scope: string;
        status: string;
        meetingType?: string;
        meetingLink?: string | null;
        agenda?: string | null;
        localityId?: string | null;
        participantIds?: string[];
    }, user?: RbacUser): Promise<{
        locality: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            code: string;
            commandName: string | null;
            commanderName: string | null;
            individualMeetingDate: Date | null;
            visitDate: Date | null;
            recruitsFemaleCountCurrent: number | null;
            notes: string | null;
        } | null;
        participants: ({
            user: {
                id: string;
                name: string;
                email: string;
            };
        } & {
            id: string;
            userId: string;
            meetingId: string;
        })[];
    } & {
        datetime: Date;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        scope: string;
        localityId: string | null;
        status: import("@prisma/client").$Enums.MeetingStatus;
        meetingType: import("@prisma/client").$Enums.MeetingType;
        meetingLink: string | null;
        agenda: string | null;
        participantsJson: Prisma.JsonValue | null;
    }>;
    update(id: string, payload: {
        datetime?: string;
        scope?: string;
        status?: string;
        meetingType?: string;
        meetingLink?: string | null;
        agenda?: string | null;
        localityId?: string | null;
        participantIds?: string[];
    }, user?: RbacUser): Promise<{
        locality: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            code: string;
            commandName: string | null;
            commanderName: string | null;
            individualMeetingDate: Date | null;
            visitDate: Date | null;
            recruitsFemaleCountCurrent: number | null;
            notes: string | null;
        } | null;
        participants: ({
            user: {
                id: string;
                name: string;
                email: string;
            };
        } & {
            id: string;
            userId: string;
            meetingId: string;
        })[];
    } & {
        datetime: Date;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        scope: string;
        localityId: string | null;
        status: import("@prisma/client").$Enums.MeetingStatus;
        meetingType: import("@prisma/client").$Enums.MeetingType;
        meetingLink: string | null;
        agenda: string | null;
        participantsJson: Prisma.JsonValue | null;
    }>;
    addDecision(meetingId: string, text: string, user?: RbacUser): Promise<{
        id: string;
        createdAt: Date;
        meetingId: string;
        text: string;
    }>;
    generateTasks(meetingId: string, payload: {
        templateId?: string;
        title?: string;
        description?: string | null;
        phaseId?: string;
        specialtyId?: string | null;
        reportRequired?: boolean;
        priority?: string;
        assigneeId?: string | null;
        assigneeIds?: string[];
        localities: {
            localityId: string;
            dueDate: string;
        }[];
    }, user?: RbacUser): Promise<{
        items: {
            id: string;
            eloRoleId: string | null;
            createdAt: Date;
            updatedAt: Date;
            taskTemplateId: string;
            localityId: string;
            status: import("@prisma/client").$Enums.TaskStatus;
            reportRequired: boolean;
            dueDate: Date;
            priority: import("@prisma/client").$Enums.TaskPriority;
            progressPercent: number;
            assigneeType: import("@prisma/client").$Enums.TaskAssigneeType | null;
            externalAssigneeName: string | null;
            externalAssigneeRole: string | null;
            blockedByIdsJson: Prisma.JsonValue | null;
            meetingId: string | null;
            assignedToId: string | null;
            assignedEloId: string | null;
        }[];
    }>;
    private getScopeConstraints;
    private assertLocality;
}
