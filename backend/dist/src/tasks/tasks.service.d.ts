import { Prisma, TaskPriority, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RbacUser } from '../rbac/rbac.types';
export declare class TasksService {
    private readonly prisma;
    private readonly audit;
    private readonly phaseLabelByCode;
    constructor(prisma: PrismaService, audit: AuditService);
    listPhases(): Promise<{
        code: string;
        defaultName: string;
        name: string;
        displayName: string | null;
        id: string;
        order: number;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    updatePhase(id: string, payload: {
        displayName?: string | null;
    }, user?: RbacUser): Promise<{
        code: string;
        defaultName: string;
        name: string;
        displayName: string | null;
        id: string;
        order: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    listTaskTemplates(): Prisma.PrismaPromise<({
        eloRole: {
            id: string;
            name: string;
            code: string;
        } | null;
    } & {
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
    })[]>;
    createTaskTemplate(data: Prisma.TaskTemplateCreateInput, user?: RbacUser): Promise<{
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
    }>;
    cloneTaskTemplate(id: string, user?: RbacUser): Promise<{
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
    }>;
    generateInstances(templateId: string, payload: {
        localities: {
            localityId: string;
            dueDate: string;
        }[];
        reportRequired?: boolean;
        priority?: TaskPriority | string;
        meetingId?: string | null;
        assignedToId?: string | null;
    }, user?: RbacUser): Promise<{
        items: {
            id: string;
            eloRoleId: string | null;
            createdAt: Date;
            updatedAt: Date;
            taskTemplateId: string;
            localityId: string;
            status: import("@prisma/client").$Enums.TaskStatus;
            dueDate: Date;
            priority: import("@prisma/client").$Enums.TaskPriority;
            progressPercent: number;
            assigneeType: import("@prisma/client").$Enums.TaskAssigneeType | null;
            externalAssigneeName: string | null;
            externalAssigneeRole: string | null;
            reportRequired: boolean;
            blockedByIdsJson: Prisma.JsonValue | null;
            meetingId: string | null;
            assignedToId: string | null;
            assignedEloId: string | null;
        }[];
    }>;
    listTaskInstances(filters: {
        localityId?: string;
        phaseId?: string;
        status?: string;
        assigneeId?: string;
        dueFrom?: string;
        dueTo?: string;
        meetingId?: string;
        eloRoleId?: string;
        page?: string;
        pageSize?: string;
    }, user?: RbacUser): Promise<{
        items: any[];
        page: number;
        pageSize: number;
        total: number;
    }>;
    getTaskInstanceById(id: string, user?: RbacUser): Promise<any>;
    listComments(id: string, user?: RbacUser): Promise<{
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
    addComment(id: string, text: string, user?: RbacUser): Promise<{
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
    markCommentsSeen(id: string, user?: RbacUser): Promise<{
        ok: boolean;
        seenAt: Date;
    }>;
    updateStatus(id: string, status: TaskStatus, user?: RbacUser): Promise<any>;
    updateProgress(id: string, progressPercent: number, user?: RbacUser): Promise<any>;
    listAssignees(localityIdRaw?: string, user?: RbacUser): Promise<{
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
    assignTask(id: string, payload: {
        assignedToId?: string | null;
        localityId?: string | null;
        assigneeType?: 'USER' | 'ELO' | 'LOCALITY_COMMAND' | 'LOCALITY_COMMANDER' | null;
        assigneeId?: string | null;
    }, user?: RbacUser): Promise<any>;
    batchAssign(ids: string[], assignedToId: string | null, user?: RbacUser): Promise<{
        updated: number;
    }>;
    batchStatus(ids: string[], status: TaskStatus, user?: RbacUser): Promise<{
        updated: number;
    }>;
    getGantt(params: {
        localityId?: string;
        from?: string;
        to?: string;
    }, user?: RbacUser): Promise<{
        items: any[];
    }>;
    getCalendar(year: number, localityId?: string, user?: RbacUser): Promise<{
        items: {
            taskInstanceId: string;
            date: Date;
            title: string;
        }[];
    }>;
    getLocalityProgress(localityId: string, user?: RbacUser): Promise<{
        localityId: string;
        overallProgress: number;
        byPhase: {
            phaseName: string;
            progress: number;
        }[];
    }>;
    getDashboardNational(user?: RbacUser): Promise<{
        items: {
            localityId: string;
            localityCode: string;
            localityName: string;
            recruitsFemaleCountCurrent: number;
            commanderName: string | null;
            individualMeetingDate: string | null;
            visitDate: string | null;
            commandName: string | null;
            notes: string | null;
            progress: number;
            late: number;
            blocked: number;
            unassigned: number;
        }[];
        totals: {
            localities: number;
            late: number;
            blocked: number;
            unassigned: number;
            recruitsFemale: number;
            reportsProduced: number;
        };
        executive_hide_pii: boolean;
    }>;
    getDashboardRecruits(user?: RbacUser): Promise<{
        currentPerLocality: {
            localityId: string;
            localityName: string;
            code: string;
            recruitsFemaleCountCurrent: number;
        }[];
        aggregateByMonth: {
            month: string;
            value: number;
        }[];
        byLocality: {
            localityId: string;
            localityName: string;
            code: string;
            series: {
                date: string;
                value: number;
            }[];
        }[];
    }>;
    getDashboardExecutive(params: {
        from?: string;
        to?: string;
        phaseId?: string;
        threshold?: string;
        command?: string;
    }, user?: RbacUser): Promise<{
        progress: {
            overall: number;
            byPhase: {
                phaseId: string;
                phaseName: import("@prisma/client").$Enums.PhaseName;
                progress: number;
            }[];
        };
        localityAboveThreshold: {
            phaseId: string;
            phaseName: import("@prisma/client").$Enums.PhaseName;
            threshold: number;
            percentLocalitiesAbove: number;
        }[];
        late: {
            total: number;
            trend: {
                week: string;
                late: number;
            }[];
        };
        unassigned: {
            total: number;
            byCommand: {
                commandName: string;
                count: number;
            }[];
        };
        leadTime: {
            phaseId: string;
            phaseName: import("@prisma/client").$Enums.PhaseName;
            avgLeadDays: number;
        }[];
        reportsCompliance: {
            approved: number;
            pending: number;
            total: number;
        };
        recruits: {
            aggregate: {
                date: string;
                value: number;
            }[];
            byLocality: {
                localityId: string;
                series: {
                    date: string;
                    value: number;
                }[];
            }[];
        };
        risk: {
            top10: {
                localityId: string;
                localityCode: string;
                commandName: string;
                score: number;
                breakdown: {
                    late: number;
                    blocked: number;
                    unassigned: number;
                    reportPending: number;
                };
            }[];
        };
    }>;
    private applyProgressRules;
    private isLate;
    private isBlocked;
    private isTaskUnassigned;
    private normalizeAssigneeSelection;
    private attachTaskCommentSummary;
    private mapTaskInstance;
    private mapTaskComment;
    private sanitizeCommentText;
    private resolveAssignee;
    private mapPhase;
    private getScopeConstraints;
    private assertConstraints;
    updateTaskMeeting(id: string, meetingId: string | null, user?: RbacUser): Promise<any>;
    updateTaskEloRole(id: string, eloRoleId: string | null, user?: RbacUser): Promise<any>;
    private hasBlockingDependencies;
    private buildTaskWhere;
    listTaskInstancesForExport(filters: {
        localityId?: string;
        phaseId?: string;
        status?: string;
        assigneeId?: string;
        dueFrom?: string;
        dueTo?: string;
    }, user?: RbacUser): Promise<any[]>;
    private parsePagination;
}
