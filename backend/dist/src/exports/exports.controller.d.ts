import type { Response } from 'express';
import type { RbacUser } from '../rbac/rbac.types';
import { TasksService } from '../tasks/tasks.service';
import { ChecklistsService } from '../checklists/checklists.service';
export declare class ExportsController {
    private readonly tasks;
    private readonly checklists;
    constructor(tasks: TasksService, checklists: ChecklistsService);
    exportTasks(localityId: string | undefined, phaseId: string | undefined, status: string | undefined, assigneeId: string | undefined, dueFrom: string | undefined, dueTo: string | undefined, user: RbacUser, res: Response): Promise<void>;
    exportChecklists(phaseId: string | undefined, specialtyId: string | undefined, user: RbacUser, res: Response): Promise<void>;
}
