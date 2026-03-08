import { SocialCommunicationAudience } from './create-social-communication-article.dto';
export declare class UpdateSocialCommunicationArticleDto {
    url?: string;
    title?: string;
    coverImageUrl?: string | null;
    summary?: string | null;
    publishedAt?: string | null;
    tags?: string[];
    audience?: SocialCommunicationAudience;
}
