export declare class GenerateMeetingTasksDto {
    templateId?: string;
    title?: string;
    description?: string | null;
    phaseId?: string;
    specialtyId?: string | null;
    reportRequired?: boolean;
    priority?: string;
    assigneeId?: string | null;
    localities: {
        localityId: string;
        dueDate: string;
    }[];
}
