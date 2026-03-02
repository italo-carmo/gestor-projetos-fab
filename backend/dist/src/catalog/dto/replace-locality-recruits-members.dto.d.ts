export declare enum RecruitMemberStatusDto {
    RECRUITMENT_TO_START = "RECRUITMENT_TO_START",
    RECRUITMENT_STARTED = "RECRUITMENT_STARTED",
    DISMISSED = "DISMISSED",
    ASSIGNED_TO_OM = "ASSIGNED_TO_OM"
}
export declare class ReplaceLocalityRecruitMemberItemDto {
    id?: string;
    name: string;
    status: RecruitMemberStatusDto;
    dismissalReason?: string | null;
    destinationLocalityId?: string | null;
}
export declare class ReplaceLocalityRecruitsMembersDto {
    items: ReplaceLocalityRecruitMemberItemDto[];
}
