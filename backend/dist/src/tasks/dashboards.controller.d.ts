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
}
