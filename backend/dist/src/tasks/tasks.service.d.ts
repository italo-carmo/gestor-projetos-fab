import { Prisma, TaskPriority, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RbacUser } from '../rbac/rbac.types';
export declare class TasksService {
    private readonly prisma;
    private readonly audit;
    private readonly manualTaskTemplateTitle;
    private readonly manualTaskTemplateDescription;
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
    updateTaskTemplate(id: string, payload: {
        title?: string;
        description?: string | null;
        phaseId?: string;
        specialtyId?: string | null;
        eloRoleId?: string | null;
        appliesToAllLocalities?: boolean;
        reportRequiredDefault?: boolean;
    }, user?: RbacUser): Promise<{
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
    deleteTaskTemplate(id: string, user?: RbacUser): Promise<{
        ok: boolean;
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
        assigneeIds?: string[];
    }, user?: RbacUser): Promise<{
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
            blockedByIdsJson: Prisma.JsonValue | null;
            meetingId: string | null;
            assignedToId: string | null;
            assignedEloId: string | null;
        }[];
    }>;
    createTaskInstancesManual(payload: {
        title: string;
        description?: string | null;
        phaseId: string;
        dueDate: string;
        priority?: TaskPriority | string;
        localityIds: string[];
        assignedToId?: string | null;
        assigneeIds?: string[];
    }, user?: RbacUser): Promise<{
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
        assigneeIds?: string;
        dueFrom?: string;
        dueTo?: string;
        meetingId?: string;
        eloRoleId?: string;
        specialtyId?: string;
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
    updateTaskTitle(id: string, title: string, user?: RbacUser): Promise<any>;
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
        assigneeIds?: string[];
        assignedToId?: string | null;
        localityId?: string | null;
        assigneeType?: 'USER' | 'ELO' | 'LOCALITY_COMMAND' | 'LOCALITY_COMMANDER' | null;
        assigneeId?: string | null;
    }, user?: RbacUser): Promise<any>;
    updateTaskLocalities(id: string, localityIdsRaw: string[], sourceTaskIdsRaw?: string[], user?: RbacUser): Promise<{
        primaryTaskId: string;
        items: any[];
    }>;
    batchAssign(ids: string[], assignedToId: string | null, assigneeIds?: string[], user?: RbacUser): Promise<{
        updated: number;
    }>;
    batchStatus(ids: string[], status: TaskStatus, user?: RbacUser): Promise<{
        updated: number;
    }>;
    batchProgress(ids: string[], progressPercent: number, user?: RbacUser): Promise<{
        updated: number;
    }>;
    batchDeleteTaskInstances(ids: string[], user?: RbacUser): Promise<{
        deleted: number;
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
    getDashboardNational(user?: RbacUser, localityId?: string): Promise<{
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
            visitCompleted: boolean;
        }[];
        totals: {
            localities: number;
            coverageLocalities: number;
            late: number;
            blocked: number;
            unassigned: number;
            recruitsFemale: number;
            reportsProduced: number;
            smifNewsCount: number;
            visitsCompleted: number;
            completedReports: number;
            completedTasks: number;
            completedFieldActivities: number;
            completedVisits: number;
            fieldActivitiesBySpecialty: {
                psychology: number;
                socialService: number;
                doctrine: number;
                law: number;
            };
        };
        lateItems: {
            activityId: string;
            title: string;
            localityId: string;
            localityCode: string;
            localityName: string;
            specialtyId: string | null;
            specialtyName: any;
            eventDate: Date | null;
            createdAt: Date;
            status: import("@prisma/client").$Enums.ActivityStatus;
            reportRequired: boolean;
            hasSignedReport: boolean;
            isLate: boolean;
            isUnassigned: boolean;
        }[];
        unassignedItems: {
            activityId: string;
            title: string;
            localityId: string;
            localityCode: string;
            localityName: string;
            specialtyId: string | null;
            specialtyName: any;
            eventDate: Date | null;
            createdAt: Date;
            status: import("@prisma/client").$Enums.ActivityStatus;
            reportRequired: boolean;
            hasSignedReport: boolean;
            isLate: boolean;
            isUnassigned: boolean;
        }[];
        riskTasks: {
            activityId: string;
            title: string;
            localityId: string;
            localityCode: string;
            localityName: string;
            specialtyId: string | null;
            specialtyName: any;
            eventDate: Date | null;
            createdAt: Date;
            status: import("@prisma/client").$Enums.ActivityStatus;
            reportRequired: boolean;
            hasSignedReport: boolean;
            isLate: boolean;
            isUnassigned: boolean;
        }[];
        executive_hide_pii: boolean;
    }>;
    getDashboardRecruits(user?: RbacUser, localityId?: string): Promise<{
        currentPerLocality: {
            localityId: string;
            localityName: string;
            code: string;
            commanderName: string | null;
            recruitsFemaleCountCurrent: number;
            recruitsByStatus: {
                toStart: number;
                started: number;
                dismissed: number;
                assignedToOm: number;
            };
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
                turnoverCount: number;
                dismissalReason: string | null;
            }[];
        }[];
        historyLog: {
            localityId: string;
            localityName: string;
            code: string;
            date: string;
            recruitsFemaleCount: number;
            turnoverCount: number;
            dismissalReason: string | null;
        }[];
        dismissedRecruitsLog: {
            recruitId: string;
            recruitName: string;
            localityId: string;
            localityName: string;
            code: string;
            dismissalReason: string | null;
            dismissedAt: string | null;
        }[];
    }>;
    getDashboardExecutive(params: {
        from?: string;
        to?: string;
        phaseId?: string;
        threshold?: string;
        command?: string;
        localityId?: string;
    }, user?: RbacUser): Promise<{
        summary: {
            totalActivities: number;
            completedActivities: number;
            completionPercent: number;
            lateActivities: number;
            unassignedActivities: number;
            reportPending: number;
            reportApproved: number;
            reportTotal: number;
        };
        status: {
            items: never[];
        };
        progress: {
            overall: number;
            byLocality: never[];
        };
        localityAboveThreshold: {
            threshold: number;
            count: number;
            total: number;
            items: never[];
        };
        specialties: {
            items: never[];
        };
        late: {
            total: number;
            trend: never[];
            items: never[];
        };
        unassigned: {
            total: number;
            byLocality: never[];
            items: never[];
        };
        reportsCompliance: {
            approved: number;
            pending: number;
            total: number;
            pendingItems: never[];
        };
        risk: {
            top10: never[];
        };
    } | {
        summary: {
            totalActivities: number;
            completedActivities: number;
            completionPercent: number;
            visitedCities: number;
            participantsInActivities: number;
            lateActivities: number;
            unassignedActivities: number;
            reportPending: number;
            reportApproved: number;
            reportTotal: number;
        };
        status: {
            items: {
                status: "CANCELLED" | "DONE" | "NOT_STARTED" | "IN_PROGRESS";
                count: number;
            }[];
        };
        progress: {
            overall: number;
            byLocality: {
                localityId: string;
                localityCode: string;
                localityName: string;
                commandName: string;
                progress: number;
                activitiesCount: number;
                done: number;
                late: number;
                unassigned: number;
                reportPending: number;
            }[];
        };
        localityAboveThreshold: {
            threshold: number;
            count: number;
            total: number;
            items: {
                localityId: string;
                localityCode: string;
                localityName: string;
                commandName: string;
                progress: number;
                activitiesCount: number;
                done: number;
                late: number;
                unassigned: number;
                reportPending: number;
            }[];
        };
        specialties: {
            items: {
                specialtyId: string | null;
                specialtyName: string;
                count: number;
            }[];
        };
        late: {
            total: number;
            trend: {
                week: string;
                late: number;
                localities: Array<{
                    localityId: string;
                    localityCode: string;
                    localityName: string;
                    count: number;
                }>;
            }[];
            items: {
                activityId: string;
                title: string;
                specialtyId: string | null;
                specialtyName: any;
                localityId: string;
                localityCode: string;
                localityName: string;
                commandName: string;
                eventDate: Date | null;
                createdAt: Date;
                status: import("@prisma/client").$Enums.ActivityStatus;
                reportRequired: boolean;
                hasSignedReport: boolean;
                isLate: boolean;
                daysLate: number;
                isUnassigned: boolean;
            }[];
        };
        unassigned: {
            total: number;
            byLocality: {
                localityId: string;
                localityCode: string;
                localityName: string;
                commandName: string;
                count: number;
            }[];
            items: {
                activityId: string;
                title: string;
                specialtyId: string | null;
                specialtyName: any;
                localityId: string;
                localityCode: string;
                localityName: string;
                commandName: string;
                eventDate: Date | null;
                createdAt: Date;
                status: import("@prisma/client").$Enums.ActivityStatus;
                reportRequired: boolean;
                hasSignedReport: boolean;
                isLate: boolean;
                daysLate: number;
                isUnassigned: boolean;
            }[];
        };
        reportsCompliance: {
            approved: number;
            pending: number;
            total: number;
            completedItems: {
                report: {
                    id: any;
                    signedAt: any;
                    date: any;
                    location: any;
                    responsible: any;
                    missionSupport: any;
                    introduction: any;
                    missionObjectives: any;
                    executionSchedule: any;
                    activitiesPerformed: any;
                    participantsCount: any;
                    instructorsCount: any;
                    recruitsCount: any;
                    eloPsychologyCount: any;
                    eloSocialAssistanceCount: any;
                    eloGraduadoMasterCount: any;
                    participantsCharacteristics: any;
                    conclusion: any;
                    city: any;
                    closingDate: any;
                } | null;
                activityId: string;
                title: string;
                specialtyId: string | null;
                specialtyName: any;
                localityId: string;
                localityCode: string;
                localityName: string;
                commandName: string;
                eventDate: Date | null;
                createdAt: Date;
                status: import("@prisma/client").$Enums.ActivityStatus;
                reportRequired: boolean;
                hasSignedReport: boolean;
                isLate: boolean;
                daysLate: number;
                isUnassigned: boolean;
            }[];
            pendingItems: {
                activityId: string;
                title: string;
                specialtyId: string | null;
                specialtyName: any;
                localityId: string;
                localityCode: string;
                localityName: string;
                commandName: string;
                eventDate: Date | null;
                createdAt: Date;
                status: import("@prisma/client").$Enums.ActivityStatus;
                reportRequired: boolean;
                hasSignedReport: boolean;
                isLate: boolean;
                daysLate: number;
                isUnassigned: boolean;
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
                    unassigned: number;
                    reportPending: number;
                };
            }[];
        };
    }>;
    debugPsicologiaActivities(params: {
        from?: string;
        to?: string;
    }, user?: RbacUser): Promise<{
        count: number;
        activities: never[];
        totalActivities?: undefined;
    } | {
        count: number;
        totalActivities: number;
        activities: {
            id: string;
            title: string;
            specialtyId: string | null;
            specialtyName: string | null;
            localityId: string | null;
            eventDate: Date | null;
            createdAt: Date;
        }[];
    }>;
    debugActivityCounts(params: {
        from?: string;
        to?: string;
    }, user?: RbacUser): Promise<{
        specialties: {
            psicologia: {
                id: null;
                name: null;
            };
            commission: {
                id: null;
                name: null;
            };
        };
        counts: {
            psicologia: number;
            commission: number;
            total: number;
        };
        bySpecialtyId: {};
        activitiesSample?: undefined;
    } | {
        specialties: {
            psicologia: {
                id: string | null;
                name: string | null;
            };
            commission: {
                id: string | null;
                name: string | null;
            };
        };
        counts: {
            psicologia: number;
            commission: number;
            total: number;
        };
        bySpecialtyId: Record<string, number>;
        activitiesSample: {
            id: string;
            title: string;
            specialtyId: string | null;
            specialtyName: any;
            activityTypeId: any;
            activityTypeName: any;
        }[];
    }>;
    private applyProgressRules;
    private isLate;
    private isBlocked;
    private isTaskUnassigned;
    private normalizeAssigneeSelection;
    private attachTaskCommentSummary;
    private resolveManualTaskTemplate;
    private mapTaskInstance;
    private mapTaskComment;
    private sanitizeCommentText;
    private resolveAssignee;
    private mapPhase;
    private getScopeConstraints;
    private assertConstraints;
    private buildTaskAccessWhere;
    private isTaskResponsibleUser;
    private matchesTaskSpecialty;
    private assertTaskViewAccess;
    private assertTaskOperateAccess;
    private assertCanAssignInLocality;
    private assertCanAssignInTaskScope;
    private assertDeleteAccess;
    private assertTemplateManageAccess;
    private resolveTaskResponsibleIds;
    updateTaskMeeting(id: string, meetingId: string | null, user?: RbacUser): Promise<any>;
    updateTaskEloRole(id: string, eloRoleId: string | null, user?: RbacUser): Promise<any>;
    updateTaskSpecialty(id: string, specialtyId: string | null, user?: RbacUser): Promise<any>;
    deleteTaskInstance(id: string, user?: RbacUser): Promise<{
        ok: boolean;
    }>;
    private hasBlockingDependencies;
    private buildTaskWhere;
    listTaskInstancesForExport(filters: {
        localityId?: string;
        allowedLocalityIds?: string[];
        phaseId?: string;
        status?: string;
        assigneeId?: string;
        assigneeIds?: string;
        dueFrom?: string;
        dueTo?: string;
        specialtyId?: string;
    }, user?: RbacUser): Promise<any[]>;
    private parsePagination;
    private getTargetLocalityIds;
}
