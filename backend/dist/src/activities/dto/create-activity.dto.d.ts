export declare class CreateActivityDto {
    title: string;
    description?: string | null;
    localityId?: string | null;
    localityIds?: string[];
    specialtyId?: string | null;
    eventDate?: string | null;
    reportRequired?: boolean;
    responsibleUserIds?: string[];
}
