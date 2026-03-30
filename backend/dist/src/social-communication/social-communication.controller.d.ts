import type { RbacUser } from '../rbac/rbac.types';
import { CreateSocialCommunicationArticleDto } from './dto/create-social-communication-article.dto';
import { CreateSocialCommunicationHighlightDto } from './dto/create-social-communication-highlight.dto';
import { LookupSocialCommunicationHighlightLdapDto } from './dto/lookup-social-communication-highlight-ldap.dto';
import { ResolveSocialCommunicationMetadataDto } from './dto/resolve-social-communication-metadata.dto';
import { UpdateSocialCommunicationArticleDto } from './dto/update-social-communication-article.dto';
import { UpdateSocialCommunicationHighlightDto } from './dto/update-social-communication-highlight.dto';
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
            audience: import("@prisma/client").$Enums.SocialCommunicationAudience;
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
    listHighlights(q: string | undefined): Promise<{
        items: any;
    }>;
    lookupHighlightLdapProfile(query: LookupSocialCommunicationHighlightLdapDto, user: RbacUser): Promise<{
        uid: string;
        name: string | null;
        email: string;
        fabom: string | null;
        numeroOrdem: string | null;
    }>;
    createHighlight(dto: CreateSocialCommunicationHighlightDto, user: RbacUser): Promise<{
        id: string;
        ldapUid: string | null;
        militaryEmail: string;
        militaryName: string;
        highlightRole: string | null;
        fabom: string | null;
        photoMimeType: string | null;
        photoBase64: string | null;
        impact: "MULTIPLICADOR" | "SIMBOLICO";
        locality: {
            id: string;
            code: string;
            name: string;
        };
        text: string;
        createdBy: {
            id: string;
            name: string;
        } | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    create(dto: CreateSocialCommunicationArticleDto, user: RbacUser): Promise<{
        createdBy: {
            id: string;
            name: string;
        } | null;
    } & {
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        createdById: string | null;
        audience: import("@prisma/client").$Enums.SocialCommunicationAudience;
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
        createdBy: {
            id: string;
            name: string;
        } | null;
    } & {
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        createdById: string | null;
        audience: import("@prisma/client").$Enums.SocialCommunicationAudience;
        coverImageUrl: string | null;
        summary: string | null;
        publishedAt: Date | null;
        tags: string[];
        sourceUrl: string;
    }>;
    updateHighlight(id: string, dto: UpdateSocialCommunicationHighlightDto, user: RbacUser): Promise<{
        id: string;
        ldapUid: string | null;
        militaryEmail: string;
        militaryName: string;
        highlightRole: string | null;
        fabom: string | null;
        photoMimeType: string | null;
        photoBase64: string | null;
        impact: "MULTIPLICADOR" | "SIMBOLICO";
        locality: {
            id: string;
            code: string;
            name: string;
        };
        text: string;
        createdBy: {
            id: string;
            name: string;
        } | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    remove(id: string, user: RbacUser): Promise<{
        ok: boolean;
    }>;
    removeHighlight(id: string, user: RbacUser): Promise<{
        ok: boolean;
    }>;
}
