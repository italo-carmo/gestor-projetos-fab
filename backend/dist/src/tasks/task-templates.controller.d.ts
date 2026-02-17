import type { RbacUser } from '../rbac/rbac.types';
import { GenerateInstancesDto } from './dto/generate-instances.dto';
import { TaskTemplateDto } from './dto/task-template.dto';
import { TasksService } from './tasks.service';
export declare class TaskTemplatesController {
    private readonly tasks;
    constructor(tasks: TasksService);
    list(): Promise<{
        items: ({
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
        })[];
    }>;
    create(dto: TaskTemplateDto, user: RbacUser): Promise<{
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
    generateInstances(id: string, dto: GenerateInstancesDto, user: RbacUser): Promise<{
        items: {
            id: string;
            eloRoleId: string | null;
            createdAt: Date;
            updatedAt: Date;
            taskTemplateId: string;
            localityId: string;
            status: import("@prisma/client").$Enums.TaskStatus;
            reportRequired: boolean;
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
    clone(id: string, user: RbacUser): Promise<{
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
}
