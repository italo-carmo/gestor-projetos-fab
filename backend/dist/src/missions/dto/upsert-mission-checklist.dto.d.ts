import { MISSION_CHECKLIST_CLASSIFICATIONS } from '../mission-checklist.constants';
export declare class UpsertMissionChecklistItemDto {
    id: string;
    classification: (typeof MISSION_CHECKLIST_CLASSIFICATIONS)[number];
    notes?: string;
    photos?: string[];
}
export declare class UpsertMissionChecklistDto {
    omId: string;
    items: UpsertMissionChecklistItemDto[];
}
