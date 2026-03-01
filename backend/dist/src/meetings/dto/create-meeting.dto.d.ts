export declare class CreateMeetingDto {
    datetime: string;
    scope: string;
    status: string;
    meetingType: string;
    meetingLink?: string | null;
    location?: string | null;
    agenda?: string | null;
    localityId?: string | null;
    participantIds?: string[];
}
