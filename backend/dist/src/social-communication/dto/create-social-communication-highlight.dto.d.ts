export declare enum SocialCommunicationHighlightImpactDto {
    MULTIPLICADOR = "MULTIPLICADOR",
    SIMBOLICO = "SIMBOLICO"
}
export declare class CreateSocialCommunicationHighlightDto {
    ldapUid?: string;
    militaryEmail: string;
    militaryName: string;
    highlightRole?: string;
    fabom?: string;
    photoMimeType?: string;
    photoBase64?: string;
    impact: SocialCommunicationHighlightImpactDto;
    localityId: string;
    text: string;
}
