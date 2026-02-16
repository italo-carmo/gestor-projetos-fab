import type { RbacUser } from '../rbac/rbac.types';
import { TasksService } from './tasks.service';
import { UpdatePhaseDto } from './dto/update-phase.dto';
export declare class PhasesController {
    private readonly tasks;
    constructor(tasks: TasksService);
    list(): Promise<{
        items: {
            code: string;
            defaultName: string;
            name: string;
            displayName: string | null;
            id: string;
            order: number;
            createdAt: Date;
            updatedAt: Date;
        }[];
    }>;
    update(id: string, dto: UpdatePhaseDto, user: RbacUser): Promise<{
        code: string;
        defaultName: string;
        name: string;
        displayName: string | null;
        id: string;
        order: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
