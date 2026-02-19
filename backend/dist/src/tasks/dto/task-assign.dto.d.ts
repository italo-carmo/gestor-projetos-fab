export declare class TaskAssignDto {
    assigneeIds?: string[];
    assignedToId?: string | null;
    localityId?: string | null;
    assigneeId?: string | null;
    assigneeType?: 'USER' | 'ELO' | 'LOCALITY_COMMAND' | 'LOCALITY_COMMANDER' | null;
}
