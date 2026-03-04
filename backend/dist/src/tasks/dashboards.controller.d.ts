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
    national(localityId: string | undefined, user: RbacUser): Promise<{
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
    recruits(localityId: string | undefined, user: RbacUser): Promise<{
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
    executive(from: string | undefined, to: string | undefined, phaseId: string | undefined, threshold: string | undefined, command: string | undefined, localityId: string | undefined, user: RbacUser): Promise<{
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
                localities: {
                    localityId: string;
                    localityCode: string;
                    localityName: string;
                    count: number;
                }[];
            }[];
            items: {
                activityId: string;
                title: string;
                specialtyId: string | null;
                specialtyName: string;
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
                specialtyName: string;
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
            pendingItems: {
                activityId: string;
                title: string;
                specialtyId: string | null;
                specialtyName: string;
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
}
