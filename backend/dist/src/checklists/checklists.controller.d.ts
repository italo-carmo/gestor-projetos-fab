import type { RbacUser } from '../rbac/rbac.types';
import { CreateChecklistDto } from './dto/create-checklist.dto';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { UpdateChecklistStatusDto } from './dto/update-checklist-status.dto';
import { ChecklistsService } from './checklists.service';
export declare class ChecklistsController {
    private readonly checklists;
    constructor(checklists: ChecklistsService);
    list(phaseId: string | undefined, specialtyId: string | undefined, eloRoleId: string | undefined, user: RbacUser): Promise<{
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
    create(dto: CreateChecklistDto, user: RbacUser): Promise<{
        id: string;
        title: string;
        phaseId: string | null;
        specialtyId: string | null;
        eloRoleId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    addItem(id: string, dto: CreateChecklistItemDto, user: RbacUser): Promise<{
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        checklistId: string;
        taskTemplateId: string | null;
    }>;
}
export declare class ChecklistItemStatusController {
    private readonly checklists;
    constructor(checklists: ChecklistsService);
    batch(dto: UpdateChecklistStatusDto, user: RbacUser): Promise<void>;
}
