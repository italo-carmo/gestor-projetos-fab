import { PrismaService } from '../prisma/prisma.service';
import { RbacUser } from '../rbac/rbac.types';
import { AuditService } from '../audit/audit.service';
export declare class ChecklistsService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    list(filters: {
        phaseId?: string;
        specialtyId?: string;
        eloRoleId?: string;
    }, user?: RbacUser): Promise<{
        items: {
            id: string;
            title: string;
            phaseId: string | null;
            specialtyId: string | null;
            eloRoleId: string | null;
            eloRole: {
                id: string;
                name: string;
                code: string;
            } | null;
            items: {
                id: string;
                title: string;
                taskTemplateId: string | null;
                sourceType: string;
                statuses: Record<string, import("@prisma/client").$Enums.ChecklistItemStatusType>;
            }[];
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
    updateStatuses(_updates: {
        checklistItemId: string;
        localityId: string;
        status: string;
    }[], _user?: RbacUser): Promise<void>;
    private getScopeConstraints;
    private assertConstraints;
    private aggregateTaskStatus;
    private aggregateActivityStatus;
    private normalizeChecklistActivityTitle;
}
