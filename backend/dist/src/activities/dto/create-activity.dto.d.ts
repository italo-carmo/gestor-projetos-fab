export declare class CreateActivityDto {
    title: string;
    description?: string | null;
    localityId?: string | null;
    specialtyId?: string | null;
    eventDate?: string | null;
    reportRequired?: boolean;
    responsibleUserIds?: string[];
}
