import { PrismaService } from '../prisma/prisma.service';
import { RbacUser } from '../rbac/rbac.types';
import { AuditService } from '../audit/audit.service';
import { TasksService } from '../tasks/tasks.service';
import { ActivitiesService } from '../activities/activities.service';
export declare class ChecklistsService {
    private readonly prisma;
    private readonly audit;
    private readonly tasks;
    private readonly activities;
    constructor(prisma: PrismaService, audit: AuditService, tasks: TasksService, activities: ActivitiesService);
    list(filters: {
        phaseId?: string;
        specialtyId?: string;
        eloRoleId?: string;
        localityId?: string;
    }, user?: RbacUser): Promise<{
        items: {
            id: string;
            title: string;
            phaseId: string | null;
            specialtyId: string | null;
            eloRoleId: string | null;
            eloRole: null;
            items: ({
                id: string;
                title: string;
                taskTemplateId: string;
                sourceType: string;
                statuses: Record<string, import("@prisma/client").$Enums.ChecklistItemStatusType>;
            } | {
                id: string;
                title: string;
                taskTemplateId: null;
                sourceType: string;
                statuses: Record<string, import("@prisma/client").$Enums.ChecklistItemStatusType>;
                availabilityByLocality: Record<string, boolean>;
                activityTypeName: string | null;
            })[];
            localityProgress: {
                localityId: string;
                percent: number;
            }[];
        }[];
        localities: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            code: string;
            catalogType: import("@prisma/client").$Enums.LocalityCatalogType;
            commandName: string | null;
            commanderName: string | null;
            individualMeetingDate: Date | null;
            visitDate: Date | null;
            recruitsFemaleCountCurrent: number | null;
            notes: string | null;
        }[];
    }>;
    create(payload: {
        title: string;
        phaseId?: string | null;
        specialtyId?: string | null;
        eloRoleId?: string | null;
    }, user?: RbacUser): Promise<{
        id: string;
        title: string;
        phaseId: string | null;
        specialtyId: string | null;
        eloRoleId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    addItem(checklistId: string, payload: {
        title: string;
        taskTemplateId?: string | null;
    }, user?: RbacUser): Promise<{
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        checklistId: string;
        taskTemplateId: string | null;
    }>;
    updateStatuses(updates: {
        checklistItemId: string;
        localityId: string;
        status: string;
    }[], user?: RbacUser): Promise<{
        updatedTasks: number;
        updatedActivities: number;
    }>;
    private normalizeChecklistTargetStatus;
    private mapChecklistToTaskStatus;
    private mapChecklistToActivityStatus;
    private getScopeConstraints;
    private assertConstraints;
    private aggregateTaskStatus;
    private aggregateActivityStatus;
    private normalizeChecklistActivityTitle;
    private buildAutomaticChecklistItems;
}
