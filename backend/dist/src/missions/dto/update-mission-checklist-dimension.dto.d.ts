import { MISSION_CHECKLIST_SECTION_IDS } from '../mission-checklist.constants';
export declare class UpdateMissionChecklistDimensionDto {
    sectionId?: (typeof MISSION_CHECKLIST_SECTION_IDS)[number];
    title?: string;
    prompt?: string;
    sortOrder?: number;
}
