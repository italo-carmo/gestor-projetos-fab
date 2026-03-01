export declare class GenerateInstancesDto {
    localities: {
        localityId: string;
        dueDate: string;
    }[];
    priority?: string;
    meetingId?: string | null;
    assignedToId?: string | null;
    assigneeIds?: string[];
}
