declare const ACTIVITY_SCOPES: readonly ["SMIF", "CIPAVD"];
export declare class CreateActivityDto {
    title: string;
    scope?: (typeof ACTIVITY_SCOPES)[number];
    description?: string | null;
    localityId?: string | null;
    localityIds?: string[];
    specialtyId?: string | null;
    specialtyIds?: string[];
    activityTypeId?: string | null;
    eventDate?: string | null;
    reportRequired?: boolean;
    responsibleUserIds?: string[];
}
export {};
