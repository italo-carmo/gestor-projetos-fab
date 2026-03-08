import type { RbacUser } from '../rbac/rbac.types';
import { CreateSocialCommunicationArticleDto } from './dto/create-social-communication-article.dto';
import { ResolveSocialCommunicationMetadataDto } from './dto/resolve-social-communication-metadata.dto';
import { UpdateSocialCommunicationArticleDto } from './dto/update-social-communication-article.dto';
import { SocialCommunicationService } from './social-communication.service';
export declare class SocialCommunicationController {
    private readonly socialCommunication;
    constructor(socialCommunication: SocialCommunicationService);
    list(q: string | undefined, tag: string | string[] | undefined): Promise<{
        items: {
            contentProxyPath: string;
            coverProxyPath: string | null;
            createdBy: {
                id: string;
                name: string;
            } | null;
            id: string;
            title: string;
            createdAt: Date;
            updatedAt: Date;
            createdById: string | null;
            coverImageUrl: string | null;
            summary: string | null;
            publishedAt: Date | null;
            tags: string[];
            sourceUrl: string;
        }[];
    }>;
    resolveMetadata(dto: ResolveSocialCommunicationMetadataDto, user: RbacUser): Promise<{
        url: string;
        title: string;
        coverImageUrl: string | null | undefined;
        summary: string | null | undefined;
        publishedAt: string | null;
    }>;
    create(dto: CreateSocialCommunicationArticleDto, user: RbacUser): Promise<{
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        createdById: string | null;
        coverImageUrl: string | null;
        summary: string | null;
        publishedAt: Date | null;
        tags: string[];
        sourceUrl: string;
    }>;
    uploadCover(file: Express.Multer.File, user: RbacUser): Promise<{
        coverImageUrl: string;
    }>;
    update(id: string, dto: UpdateSocialCommunicationArticleDto, user: RbacUser): Promise<{
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        createdById: string | null;
        coverImageUrl: string | null;
        summary: string | null;
        publishedAt: Date | null;
        tags: string[];
        sourceUrl: string;
    }>;
    remove(id: string, user: RbacUser): Promise<{
        ok: boolean;
    }>;
}
