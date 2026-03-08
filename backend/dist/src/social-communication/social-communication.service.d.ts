import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { RbacUser } from '../rbac/rbac.types';
export declare class SocialCommunicationService {
    private readonly prisma;
    private readonly audit;
    private readonly config;
    constructor(prisma: PrismaService, audit: AuditService, config: ConfigService);
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
            coverImageUrl: string | null;
            summary: string | null;
            publishedAt: Date | null;
            tags: string[];
            sourceUrl: string;
        }[];
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
    update(id: string, payload: {
        url?: string;
        title?: string;
        coverImageUrl?: string | null;
        summary?: string | null;
        publishedAt?: string | null;
        tags?: string[];
        audience?: 'INTERNAL' | 'EXTERNAL';
    }, user?: RbacUser): Promise<{
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
