export declare class CreateMissionDto {
    title: string;
    description?: string | null;
    localityId: string;
    scope?: 'SMIF' | 'CIPAVD';
    startDate: string;
    endDate: string;
}
