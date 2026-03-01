export declare class CreateTaskInstanceDto {
    title: string;
    description?: string | null;
    phaseId: string;
    dueDate: string;
    priority?: string;
    localityIds: string[];
    assignedToId?: string | null;
    assigneeIds?: string[];
}
