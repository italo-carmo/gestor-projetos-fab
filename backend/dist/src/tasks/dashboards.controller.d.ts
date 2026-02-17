import type { RbacUser } from '../rbac/rbac.types';
import { TasksService } from './tasks.service';
export declare class DashboardsController {
    private readonly tasks;
    constructor(tasks: TasksService);
    progress(id: string, user: RbacUser): Promise<{
        localityId: string;
        overallProgress: number;
        byPhase: {
            phaseName: string;
            progress: number;
        }[];
    }>;
    national(user: RbacUser): Promise<{
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
        lateItems: {
            taskId: string;
            title: string;
            localityId: string;
            localityCode: string;
            localityName: string;
            phaseId: string;
            dueDate: Date;
            status: import("@prisma/client").$Enums.TaskStatus;
            priority: import("@prisma/client").$Enums.TaskPriority;
            progressPercent: number;
            isLate: boolean;
            isUnassigned: boolean;
            isBlocked: boolean;
        }[];
        unassignedItems: {
            taskId: string;
            title: string;
            localityId: string;
            localityCode: string;
            localityName: string;
            phaseId: string;
            dueDate: Date;
            status: import("@prisma/client").$Enums.TaskStatus;
            priority: import("@prisma/client").$Enums.TaskPriority;
            progressPercent: number;
            isLate: boolean;
            isUnassigned: boolean;
            isBlocked: boolean;
        }[];
        riskTasks: {
            taskId: string;
            title: string;
            localityId: string;
            localityCode: string;
            localityName: string;
            phaseId: string;
            dueDate: Date;
            status: import("@prisma/client").$Enums.TaskStatus;
            priority: import("@prisma/client").$Enums.TaskPriority;
            progressPercent: number;
            isLate: boolean;
            isUnassigned: boolean;
            isBlocked: boolean;
        }[];
        executive_hide_pii: boolean;
    }>;
    recruits(user: RbacUser): Promise<{
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
    executive(from: string | undefined, to: string | undefined, phaseId: string | undefined, threshold: string | undefined, command: string | undefined, user: RbacUser): Promise<{
        progress: {
            overall: number;
            byPhase: {
                phaseId: string;
                phaseName: import("@prisma/client").$Enums.PhaseName;
                progress: number;
            }[];
            byLocality: {
                localityId: string;
                localityCode: string;
                localityName: string;
                progress: number;
                tasksCount: number;
            }[];
        };
        localityAboveThreshold: {
            phaseId: string;
            phaseName: import("@prisma/client").$Enums.PhaseName;
            threshold: number;
            localitiesAboveCount: number;
            localitiesBelowCount: number;
            percentLocalitiesAbove: number;
            localitiesAbove: {
                localityId: string;
                localityCode: string;
                localityName: string;
                progress: number;
            }[];
            localitiesBelow: {
                localityId: string;
                localityCode: string;
                localityName: string;
                progress: number;
            }[];
        }[];
        late: {
            total: number;
            trend: {
                week: string;
                late: number;
                localities: {
                    localityId: string;
                    localityCode: string;
                    localityName: string;
                    count: number;
                }[];
            }[];
            items: {
                taskId: any;
                title: any;
                phaseId: any;
                phaseName: any;
                localityId: any;
                localityCode: string;
                localityName: string;
                dueDate: any;
                status: any;
                priority: any;
                progressPercent: any;
                reportRequired: any;
                isLate: boolean;
                daysLate: number;
                isUnassigned: boolean;
                isBlocked: boolean;
            }[];
        };
        unassigned: {
            total: number;
            byCommand: {
                commandName: string;
                count: number;
            }[];
            byLocality: {
                localityId: string;
                localityCode: string;
                localityName: string;
                commandName: string;
                count: number;
            }[];
            items: {
                taskId: any;
                title: any;
                phaseId: any;
                phaseName: any;
                localityId: any;
                localityCode: string;
                localityName: string;
                dueDate: any;
                status: any;
                priority: any;
                progressPercent: any;
                reportRequired: any;
                isLate: boolean;
                daysLate: number;
                isUnassigned: boolean;
                isBlocked: boolean;
            }[];
        };
        blocked: {
            total: number;
            byLocality: {
                localityId: string;
                localityCode: string;
                localityName: string;
                commandName: string;
                count: number;
            }[];
            items: {
                taskId: any;
                title: any;
                phaseId: any;
                phaseName: any;
                localityId: any;
                localityCode: string;
                localityName: string;
                dueDate: any;
                status: any;
                priority: any;
                progressPercent: any;
                reportRequired: any;
                isLate: boolean;
                daysLate: number;
                isUnassigned: boolean;
                isBlocked: boolean;
            }[];
        };
        leadTime: {
            phaseId: string;
            phaseName: import("@prisma/client").$Enums.PhaseName;
            avgLeadDays: number;
            doneCount: number;
            sampleTasks: {
                leadDays: number;
                taskId: any;
                title: any;
                phaseId: any;
                phaseName: any;
                localityId: any;
                localityCode: string;
                localityName: string;
                dueDate: any;
                status: any;
                priority: any;
                progressPercent: any;
                reportRequired: any;
                isLate: boolean;
                daysLate: number;
                isUnassigned: boolean;
                isBlocked: boolean;
            }[];
        }[];
        reportsCompliance: {
            approved: number;
            pending: number;
            total: number;
            pendingItems: {
                taskId: any;
                title: any;
                phaseId: any;
                phaseName: any;
                localityId: any;
                localityCode: string;
                localityName: string;
                dueDate: any;
                status: any;
                priority: any;
                progressPercent: any;
                reportRequired: any;
                isLate: boolean;
                daysLate: number;
                isUnassigned: boolean;
                isBlocked: boolean;
            }[];
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
}
