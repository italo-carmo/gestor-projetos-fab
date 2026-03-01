import type { RbacUser } from '../rbac/rbac.types';
import { TaskAssignDto } from './dto/task-assign.dto';
import { TaskCommentDto } from './dto/task-comment.dto';
import { TaskEloRoleDto } from './dto/task-elo-role.dto';
import { TaskMeetingDto } from './dto/task-meeting.dto';
import { TaskLocalitiesDto } from './dto/task-localities.dto';
import { TaskProgressDto } from './dto/task-progress.dto';
import { TaskSpecialtyDto } from './dto/task-specialty.dto';
import { TaskStatusDto } from './dto/task-status.dto';
import { CreateTaskInstanceDto } from './dto/create-task-instance.dto';
import { TaskTitleDto } from './dto/task-title.dto';
import { TasksService } from './tasks.service';
export declare class TaskInstancesController {
    private readonly tasks;
    constructor(tasks: TasksService);
    listAssignees(localityId: string | undefined, user: RbacUser): Promise<{
        localityId: null;
        localityName: null;
        items: never[];
    } | {
        localityId: string;
        localityName: string;
        items: {
            type: string;
            id: string;
            label: string;
            subtitle?: string;
        }[];
    }>;
    list(localityId: string | undefined, phaseId: string | undefined, status: string | undefined, assigneeId: string | undefined, assigneeIds: string | undefined, dueFrom: string | undefined, dueTo: string | undefined, meetingId: string | undefined, eloRoleId: string | undefined, specialtyId: string | undefined, page: string | undefined, pageSize: string | undefined, user: RbacUser): Promise<{
        items: any[];
        page: number;
        pageSize: number;
        total: number;
    }>;
    create(dto: CreateTaskInstanceDto, user: RbacUser): Promise<{
        items: {
            id: string;
            specialtyId: string | null;
            eloRoleId: string | null;
            createdAt: Date;
            updatedAt: Date;
            taskTemplateId: string;
            localityId: string;
            status: import("@prisma/client").$Enums.TaskStatus;
            reportRequired: boolean;
            groupKey: string | null;
            titleOverride: string | null;
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
    batchAssign(body: {
        ids: string[];
        assignedToId: string | null;
        assigneeIds?: string[];
    }, user: RbacUser): Promise<{
        updated: number;
    }>;
    batchStatus(body: {
        ids: string[];
        status: string;
    }, user: RbacUser): Promise<{
        updated: number;
    }>;
    batchProgress(body: {
        ids: string[];
        progressPercent: number;
    }, user: RbacUser): Promise<{
        updated: number;
    }>;
    batchDelete(body: {
        ids: string[];
    }, user: RbacUser): Promise<{
        deleted: number;
    }>;
    comments(id: string, user: RbacUser): Promise<{
        items: {
            id: any;
            taskInstanceId: any;
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
    addComment(id: string, dto: TaskCommentDto, user: RbacUser): Promise<{
        id: any;
        taskInstanceId: any;
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
    updateStatus(id: string, dto: TaskStatusDto, user: RbacUser): Promise<any>;
    updateProgress(id: string, dto: TaskProgressDto, user: RbacUser): Promise<any>;
    updateTitle(id: string, dto: TaskTitleDto, user: RbacUser): Promise<any>;
    assign(id: string, dto: TaskAssignDto, user: RbacUser): Promise<any>;
    updateLocalities(id: string, dto: TaskLocalitiesDto, user: RbacUser): Promise<{
        primaryTaskId: string;
        items: any[];
    }>;
    updateMeeting(id: string, dto: TaskMeetingDto, user: RbacUser): Promise<any>;
    updateEloRole(id: string, dto: TaskEloRoleDto, user: RbacUser): Promise<any>;
    updateSpecialty(id: string, dto: TaskSpecialtyDto, user: RbacUser): Promise<any>;
    remove(id: string, user: RbacUser): Promise<{
        ok: boolean;
    }>;
    gantt(localityId: string | undefined, from: string | undefined, to: string | undefined, user: RbacUser): Promise<{
        items: any[];
    }>;
    calendar(year: string, localityId: string | undefined, user: RbacUser): Promise<{
        items: {
            taskInstanceId: string;
            date: Date;
            title: string;
        }[];
    }>;
    getById(id: string, user: RbacUser): Promise<any>;
}
