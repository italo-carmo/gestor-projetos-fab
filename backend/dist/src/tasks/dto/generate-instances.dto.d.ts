export declare class GenerateInstancesDto {
    localities: {
        localityId: string;
        dueDate: string;
    }[];
    reportRequired?: boolean;
    priority?: string;
    meetingId?: string | null;
    assignedToId?: string | null;
    assigneeIds?: string[];
}
