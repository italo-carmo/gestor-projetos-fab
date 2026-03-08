export declare enum SocialCommunicationAudience {
    INTERNAL = "INTERNAL",
    EXTERNAL = "EXTERNAL"
}
export declare class CreateSocialCommunicationArticleDto {
    url: string;
    title?: string;
    coverImageUrl?: string | null;
    summary?: string | null;
    publishedAt?: string | null;
    tags?: string[];
    audience?: SocialCommunicationAudience;
}
