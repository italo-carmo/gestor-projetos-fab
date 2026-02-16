import type { RbacUser } from '../rbac/rbac.types';
import { TaskAssignDto } from './dto/task-assign.dto';
import { TaskCommentDto } from './dto/task-comment.dto';
import { TaskEloRoleDto } from './dto/task-elo-role.dto';
import { TaskMeetingDto } from './dto/task-meeting.dto';
import { TaskProgressDto } from './dto/task-progress.dto';
import { TaskStatusDto } from './dto/task-status.dto';
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
    list(localityId: string | undefined, phaseId: string | undefined, status: string | undefined, assigneeId: string | undefined, dueFrom: string | undefined, dueTo: string | undefined, meetingId: string | undefined, eloRoleId: string | undefined, page: string | undefined, pageSize: string | undefined, user: RbacUser): Promise<{
        items: any[];
        page: number;
        pageSize: number;
        total: number;
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
    assign(id: string, dto: TaskAssignDto, user: RbacUser): Promise<any>;
    updateMeeting(id: string, dto: TaskMeetingDto, user: RbacUser): Promise<any>;
    updateEloRole(id: string, dto: TaskEloRoleDto, user: RbacUser): Promise<any>;
    batchAssign(body: {
        ids: string[];
        assignedToId: string | null;
    }, user: RbacUser): Promise<{
        updated: number;
    }>;
    batchStatus(body: {
        ids: string[];
        status: string;
    }, user: RbacUser): Promise<{
        updated: number;
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
