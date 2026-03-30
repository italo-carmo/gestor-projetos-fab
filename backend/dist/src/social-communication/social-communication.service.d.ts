import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { RbacUser } from '../rbac/rbac.types';
import { FabLdapService } from '../ldap/fab-ldap.service';
type HighlightImpact = 'MULTIPLICADOR' | 'SIMBOLICO';
export declare class SocialCommunicationService {
    private readonly prisma;
    private readonly audit;
    private readonly config;
    private readonly fabLdap;
    constructor(prisma: PrismaService, audit: AuditService, config: ConfigService, fabLdap: FabLdapService);
    list(filters: {
        q?: string;
        tags?: string[];
    }): Promise<{
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
    listHighlights(filters: {
        q?: string;
    }): Promise<{
        items: any;
    }>;
    lookupHighlightLdapProfile(email: string, user?: RbacUser): Promise<{
        uid: string;
        name: string | null;
        email: string;
        fabom: string | null;
        numeroOrdem: string | null;
    }>;
    createHighlight(payload: {
        ldapUid?: string | null;
        militaryEmail: string;
        militaryName: string;
        highlightRole?: string | null;
        fabom?: string | null;
        photoMimeType?: string | null;
        photoBase64?: string | null;
        impact: HighlightImpact;
        localityId: string;
        text: string;
    }, user?: RbacUser): Promise<{
        id: string;
        ldapUid: string | null;
        militaryEmail: string;
        militaryName: string;
        highlightRole: string | null;
        fabom: string | null;
        photoMimeType: string | null;
        photoBase64: string | null;
        impact: HighlightImpact;
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
    updateHighlight(id: string, payload: {
        ldapUid?: string | null;
        militaryEmail?: string;
        militaryName?: string;
        highlightRole?: string | null;
        fabom?: string | null;
        photoMimeType?: string | null;
        photoBase64?: string | null;
        impact?: HighlightImpact;
        localityId?: string;
        text?: string;
    }, user?: RbacUser): Promise<{
        id: string;
        ldapUid: string | null;
        militaryEmail: string;
        militaryName: string;
        highlightRole: string | null;
        fabom: string | null;
        photoMimeType: string | null;
        photoBase64: string | null;
        impact: HighlightImpact;
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
    removeHighlight(id: string, user?: RbacUser): Promise<{
        ok: boolean;
    }>;
    create(payload: {
        url: string;
        title?: string;
        coverImageUrl?: string | null;
        summary?: string | null;
        publishedAt?: string | null;
        tags?: string[];
        audience?: 'INTERNAL' | 'EXTERNAL';
    }, user?: RbacUser): Promise<{
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
    update(id: string, payload: {
        url?: string;
        title?: string;
        coverImageUrl?: string | null;
        summary?: string | null;
        publishedAt?: string | null;
        tags?: string[];
        audience?: 'INTERNAL' | 'EXTERNAL';
    }, user?: RbacUser): Promise<{
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
    remove(id: string, user?: RbacUser): Promise<{
        ok: boolean;
    }>;
    resolveMetadata(url: string, user?: RbacUser): Promise<{
        url: string;
        title: string;
        coverImageUrl: string | null | undefined;
        summary: string | null | undefined;
        publishedAt: string | null;
    }>;
    getPublicContent(articleId: string, exp: string, sig: string): Promise<{
        html: string;
    }>;
    getPublicCover(articleId: string, exp: string, sig: string): Promise<{
        buffer: NonSharedBuffer;
        contentType: string;
        sourceUrl: string;
    }>;
    getPublicAsset(url: string, exp: string, sig: string): Promise<{
        buffer: Buffer<ArrayBuffer>;
        contentType: string;
        sourceUrl: string;
    }>;
    getPublicPage(url: string, exp: string, sig: string): Promise<{
        html: string;
    }>;
    ensureEditorAccess(user?: RbacUser): void;
    private assertHighlightEditorAccess;
    private assertEditorAccess;
    private buildContentProxyPath;
    private buildCoverProxyPath;
    private buildAssetProxyPath;
    private buildPageProxyPath;
    private createProxySignature;
    private assertProxySignature;
    private signProxyPayload;
    private safeEqual;
    private getProxySecret;
    private fetchRemoteHtml;
    private fetchRemoteAsset;
    private fetchRemote;
    private rewriteHtmlForProxy;
    private rewriteMediaTag;
    private rewriteScriptTag;
    private rewriteLinkTag;
    private rewriteAnchorTag;
    private shouldDropLinkTag;
    private rewriteStyleAttribute;
    private rewriteTagAttribute;
    private removeTagAttribute;
    private ensureTagAttribute;
    private rewriteSrcset;
    private rewriteCssForProxy;
    private rewriteJavascriptForProxy;
    private resolveProxyAssetValue;
    private resolveProxyNavigationValue;
    private isLikelyBinaryAsset;
    private resolveResourceUrl;
    private toHighlightResponse;
    private assertHighlightLocalityExists;
    private normalizeHighlightEmail;
    private normalizeHighlightImpact;
    private normalizeHighlightPhotoMimeType;
    private normalizeHighlightPhotoBase64;
    private normalizeHighlightText;
    private normalizeRequiredText;
    private normalizeOptionalText;
    private normalizeTags;
    private normalizeUrl;
    private resolveCoverUrl;
    private parseOptionalDate;
    private buildFallbackTitle;
    private extractMetadataSafe;
    private extractMetadata;
    private extractMetaMap;
    private parseTagAttributes;
    private extractTitleTag;
    private firstNonEmpty;
    private decodeHtmlEntities;
}
export {};
