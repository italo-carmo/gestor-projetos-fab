import type { RbacUser } from '../rbac/rbac.types';
import { GenerateInstancesDto } from './dto/generate-instances.dto';
import { TaskTemplateDto } from './dto/task-template.dto';
import { UpdateTaskTemplateDto } from './dto/update-task-template.dto';
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
            deletedAt: Date | null;
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
        deletedAt: Date | null;
    }>;
    update(id: string, dto: UpdateTaskTemplateDto, user: RbacUser): Promise<{
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
        deletedAt: Date | null;
    }>;
    generateInstances(id: string, dto: GenerateInstancesDto, user: RbacUser): Promise<{
        items: any[];
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
        deletedAt: Date | null;
    }>;
    remove(id: string, user: RbacUser): Promise<{
        ok: boolean;
    }>;
}
