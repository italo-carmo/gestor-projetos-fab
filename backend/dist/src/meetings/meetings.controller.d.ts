import type { RbacUser } from '../rbac/rbac.types';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { MeetingDecisionDto } from './dto/meeting-decision.dto';
import { GenerateMeetingTasksDto } from './dto/generate-meeting-tasks.dto';
import { MeetingsService } from './meetings.service';
export declare class MeetingsController {
    private readonly meetings;
    constructor(meetings: MeetingsService);
    list(status: string | undefined, scope: string | undefined, localityId: string | undefined, from: string | undefined, to: string | undefined, page: string | undefined, pageSize: string | undefined, user: RbacUser): Promise<{
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
                blockedByIdsJson: import("@prisma/client/runtime/client").JsonValue | null;
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
            participantsJson: import("@prisma/client/runtime/client").JsonValue | null;
        })[];
        page: number;
        pageSize: number;
        total: number;
    }>;
    create(dto: CreateMeetingDto, user: RbacUser): Promise<{
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
        participantsJson: import("@prisma/client/runtime/client").JsonValue | null;
    }>;
    update(id: string, dto: UpdateMeetingDto, user: RbacUser): Promise<{
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
        participantsJson: import("@prisma/client/runtime/client").JsonValue | null;
    }>;
    addDecision(id: string, dto: MeetingDecisionDto, user: RbacUser): Promise<{
        id: string;
        createdAt: Date;
        meetingId: string;
        text: string;
    }>;
    generateTasks(id: string, dto: GenerateMeetingTasksDto, user: RbacUser): Promise<{
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
            blockedByIdsJson: import("@prisma/client/runtime/client").JsonValue | null;
            meetingId: string | null;
            assignedToId: string | null;
            assignedEloId: string | null;
        }[];
    }>;
    private assertMeetingsAccess;
}
