"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialCommunicationService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_crypto_1 = require("node:crypto");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const audit_service_1 = require("../audit/audit.service");
const http_error_1 = require("../common/http-error");
const sanitize_1 = require("../common/sanitize");
const prisma_service_1 = require("../prisma/prisma.service");
const role_access_1 = require("../rbac/role-access");
const social_communication_storage_1 = require("./social-communication-storage");
let SocialCommunicationService = class SocialCommunicationService {
    prisma;
    audit;
    config;
    constructor(prisma, audit, config) {
        this.prisma = prisma;
        this.audit = audit;
        this.config = config;
    }
    async list(filters) {
        const where = {};
        const normalizedTags = this.normalizeTags(filters.tags);
        if (filters.q) {
            where.OR = [
                { title: { contains: filters.q, mode: 'insensitive' } },
                { summary: { contains: filters.q, mode: 'insensitive' } },
                { sourceUrl: { contains: filters.q, mode: 'insensitive' } },
            ];
        }
        if (normalizedTags && normalizedTags.length > 0) {
            where.tags = { hasSome: normalizedTags };
        }
        const rows = await this.prisma.socialCommunicationArticle.findMany({
            where,
            include: {
                createdBy: { select: { id: true, name: true } },
            },
            orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        });
        const items = rows.map((item) => ({
            ...item,
            contentProxyPath: this.buildContentProxyPath(item.id),
            coverProxyPath: item.coverImageUrl
                ? this.buildCoverProxyPath(item.id)
                : null,
        }));
        return { items };
    }
    async create(payload, user) {
        this.assertEditorAccess(user);
        const sourceUrl = this.normalizeUrl(payload.url, 'url');
        const metadata = await this.extractMetadataSafe(sourceUrl);
        const created = await this.prisma.socialCommunicationArticle.create({
            data: {
                sourceUrl,
                title: this.normalizeRequiredText(payload.title ?? metadata.title ?? this.buildFallbackTitle(sourceUrl), 'title'),
                coverImageUrl: this.resolveCoverUrl(payload.coverImageUrl ?? metadata.coverImageUrl ?? null, sourceUrl),
                summary: this.normalizeOptionalText(payload.summary ?? metadata.summary ?? null),
                tags: this.normalizeTags(payload.tags) ?? [],
                audience: payload.audience ?? 'INTERNAL',
                publishedAt: this.parseOptionalDate(payload.publishedAt ?? metadata.publishedAt ?? null, 'publishedAt'),
                createdById: user?.id ?? null,
            },
            include: {
                createdBy: { select: { id: true, name: true } },
            },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'social_communication',
            action: 'create',
            entityId: created.id,
            diffJson: {
                sourceUrl: created.sourceUrl,
                title: created.title,
            },
        });
        return created;
    }
    async update(id, payload, user) {
        this.assertEditorAccess(user);
        const existing = await this.prisma.socialCommunicationArticle.findUnique({
            where: { id },
        });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
        const sourceUrl = payload.url
            ? this.normalizeUrl(payload.url, 'url')
            : existing.sourceUrl;
        const sourceUrlChanged = sourceUrl !== existing.sourceUrl;
        const metadata = sourceUrlChanged
            ? await this.extractMetadataSafe(sourceUrl)
            : {};
        const title = payload.title !== undefined
            ? this.normalizeRequiredText(payload.title, 'title')
            : sourceUrlChanged
                ? this.normalizeRequiredText(metadata.title ??
                    existing.title ??
                    this.buildFallbackTitle(sourceUrl), 'title')
                : undefined;
        let coverImageUrl;
        if (payload.coverImageUrl !== undefined) {
            coverImageUrl = this.resolveCoverUrl(payload.coverImageUrl, sourceUrl);
        }
        else if (sourceUrlChanged) {
            coverImageUrl =
                this.resolveCoverUrl(metadata.coverImageUrl ?? null, sourceUrl) ??
                    existing.coverImageUrl ??
                    null;
        }
        const summary = payload.summary !== undefined
            ? this.normalizeOptionalText(payload.summary)
            : sourceUrlChanged
                ? this.normalizeOptionalText(metadata.summary ?? existing.summary ?? null)
                : undefined;
        const publishedAt = payload.publishedAt !== undefined
            ? this.parseOptionalDate(payload.publishedAt, 'publishedAt')
            : sourceUrlChanged
                ? (this.parseOptionalDate(metadata.publishedAt ?? null, 'publishedAt') ??
                    existing.publishedAt ??
                    null)
                : undefined;
        const tags = payload.tags !== undefined ? (this.normalizeTags(payload.tags) ?? []) : undefined;
        const audience = payload.audience !== undefined ? payload.audience : undefined;
        const updated = await this.prisma.socialCommunicationArticle.update({
            where: { id },
            data: {
                sourceUrl,
                title,
                coverImageUrl,
                summary,
                publishedAt,
                tags,
                audience,
            },
            include: {
                createdBy: { select: { id: true, name: true } },
            },
        });
        await this.audit.log({
            userId: user?.id,
            resource: 'social_communication',
            action: 'update',
            entityId: id,
            diffJson: {
                sourceUrl: updated.sourceUrl,
                title: updated.title,
            },
        });
        return updated;
    }
    async remove(id, user) {
        this.assertEditorAccess(user);
        const existing = await this.prisma.socialCommunicationArticle.findUnique({
            where: { id },
        });
        if (!existing)
            (0, http_error_1.throwError)('NOT_FOUND');
        await this.prisma.socialCommunicationArticle.delete({ where: { id } });
        await this.audit.log({
            userId: user?.id,
            resource: 'social_communication',
            action: 'delete',
            entityId: id,
            diffJson: {
                sourceUrl: existing.sourceUrl,
                title: existing.title,
            },
        });
        return { ok: true };
    }
    async resolveMetadata(url, user) {
        this.assertEditorAccess(user);
        const sourceUrl = this.normalizeUrl(url, 'url');
        const metadata = await this.extractMetadataSafe(sourceUrl);
        const title = this.normalizeRequiredText(metadata.title ?? this.buildFallbackTitle(sourceUrl), 'title');
        return {
            url: sourceUrl,
            title,
            coverImageUrl: this.resolveCoverUrl(metadata.coverImageUrl ?? null, sourceUrl),
            summary: this.normalizeOptionalText(metadata.summary ?? null),
            publishedAt: this.parseOptionalDate(metadata.publishedAt ?? null, 'publishedAt')?.toISOString() ?? null,
        };
    }
    async getPublicContent(articleId, exp, sig) {
        const normalizedId = (0, sanitize_1.sanitizeText)(articleId);
        if (!normalizedId) {
            (0, http_error_1.throwError)('NOT_FOUND');
        }
        this.assertProxySignature('content', normalizedId, exp, sig);
        const article = await this.prisma.socialCommunicationArticle.findUnique({
            where: { id: normalizedId },
            select: { id: true, sourceUrl: true },
        });
        if (!article)
            (0, http_error_1.throwError)('NOT_FOUND');
        const payload = await this.fetchRemoteHtml(article.sourceUrl);
        const html = this.rewriteHtmlForProxy(payload.html, payload.sourceUrl);
        return { html };
    }
    async getPublicCover(articleId, exp, sig) {
        const normalizedId = (0, sanitize_1.sanitizeText)(articleId);
        if (!normalizedId) {
            (0, http_error_1.throwError)('NOT_FOUND');
        }
        this.assertProxySignature('cover', normalizedId, exp, sig);
        const article = await this.prisma.socialCommunicationArticle.findUnique({
            where: { id: normalizedId },
            select: { coverImageUrl: true },
        });
        if (!article?.coverImageUrl)
            (0, http_error_1.throwError)('NOT_FOUND');
        if (article.coverImageUrl.startsWith('/social-communication/uploads/')) {
            const filename = path.basename(article.coverImageUrl);
            const filePath = (0, social_communication_storage_1.getSocialCommunicationCoverCandidates)(filename).find((candidate) => fs.existsSync(candidate));
            if (!filePath)
                (0, http_error_1.throwError)('NOT_FOUND');
            const buffer = fs.readFileSync(filePath);
            const extension = path.extname(filename).toLowerCase();
            const contentType = extension === '.png'
                ? 'image/png'
                : extension === '.webp'
                    ? 'image/webp'
                    : extension === '.gif'
                        ? 'image/gif'
                        : 'image/jpeg';
            return {
                buffer,
                contentType,
                sourceUrl: article.coverImageUrl,
            };
        }
        try {
            return await this.fetchRemoteAsset(article.coverImageUrl, 'image/*,*/*;q=0.8');
        }
        catch {
            (0, http_error_1.throwError)('NOT_FOUND');
        }
    }
    async getPublicAsset(url, exp, sig) {
        const normalizedUrl = this.normalizeUrl(url, 'url');
        this.assertProxySignature('asset', normalizedUrl, exp, sig);
        const payload = await this.fetchRemoteAsset(normalizedUrl);
        const contentTypeLower = payload.contentType.toLowerCase();
        const isCss = contentTypeLower.includes('text/css') ||
            /\.css(?:$|[?#])/i.test(payload.sourceUrl);
        const isJavascript = contentTypeLower.includes('javascript') ||
            contentTypeLower.includes('ecmascript') ||
            /\.m?js(?:$|[?#])/i.test(payload.sourceUrl);
        if (isCss) {
            const css = payload.buffer.toString('utf-8');
            const rewritten = this.rewriteCssForProxy(css, payload.sourceUrl);
            return {
                ...payload,
                contentType: 'text/css; charset=utf-8',
                buffer: Buffer.from(rewritten, 'utf-8'),
            };
        }
        if (isJavascript) {
            const js = payload.buffer.toString('utf-8');
            const rewritten = this.rewriteJavascriptForProxy(js, payload.sourceUrl);
            return {
                ...payload,
                contentType: 'application/javascript; charset=utf-8',
                buffer: Buffer.from(rewritten, 'utf-8'),
            };
        }
        return payload;
    }
    async getPublicPage(url, exp, sig) {
        const normalizedUrl = this.normalizeUrl(url, 'url');
        this.assertProxySignature('page', normalizedUrl, exp, sig);
        const payload = await this.fetchRemoteHtml(normalizedUrl);
        const html = this.rewriteHtmlForProxy(payload.html, payload.sourceUrl);
        return { html };
    }
    ensureEditorAccess(user) {
        this.assertEditorAccess(user);
    }
    assertEditorAccess(user) {
        if (!(0, role_access_1.hasAnyRole)(user, [
            role_access_1.ROLE_COORDENACAO_CIPAVD,
            role_access_1.ROLE_COMANDANTE_COMGEP,
            role_access_1.ROLE_TI,
        ])) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
    buildContentProxyPath(articleId) {
        const signature = this.createProxySignature('content', articleId);
        return `/social-communication/proxy/content?articleId=${encodeURIComponent(articleId)}&exp=${signature.exp}&sig=${encodeURIComponent(signature.sig)}`;
    }
    buildCoverProxyPath(articleId) {
        const signature = this.createProxySignature('cover', articleId);
        return `/social-communication/proxy/cover?articleId=${encodeURIComponent(articleId)}&exp=${signature.exp}&sig=${encodeURIComponent(signature.sig)}`;
    }
    buildAssetProxyPath(url) {
        const normalizedUrl = this.normalizeUrl(url, 'url');
        const signature = this.createProxySignature('asset', normalizedUrl);
        return `asset?url=${encodeURIComponent(normalizedUrl)}&exp=${signature.exp}&sig=${encodeURIComponent(signature.sig)}`;
    }
    buildPageProxyPath(url) {
        const normalizedUrl = this.normalizeUrl(url, 'url');
        const signature = this.createProxySignature('page', normalizedUrl);
        return `page?url=${encodeURIComponent(normalizedUrl)}&exp=${signature.exp}&sig=${encodeURIComponent(signature.sig)}`;
    }
    createProxySignature(type, value) {
        const exp = Date.now() + 1000 * 60 * 60 * 12;
        const payload = `${type}|${value}|${exp}`;
        return {
            exp: String(exp),
            sig: this.signProxyPayload(payload),
        };
    }
    assertProxySignature(type, value, expRaw, sig) {
        const exp = Number.parseInt(String(expRaw ?? '').trim(), 10);
        if (!Number.isFinite(exp) || exp <= Date.now()) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
        const expectedSig = this.signProxyPayload(`${type}|${value}|${exp}`);
        if (!this.safeEqual(expectedSig, String(sig ?? '').trim())) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
    }
    signProxyPayload(payload) {
        return (0, node_crypto_1.createHmac)('sha256', this.getProxySecret())
            .update(payload)
            .digest('base64url');
    }
    safeEqual(a, b) {
        const left = Buffer.from(a);
        const right = Buffer.from(b);
        if (left.length !== right.length)
            return false;
        return (0, node_crypto_1.timingSafeEqual)(left, right);
    }
    getProxySecret() {
        return (this.config.get('SOCIAL_COMM_PROXY_SECRET') ||
            this.config.get('JWT_SECRET') ||
            'cipavd-social-communication-proxy');
    }
    async fetchRemoteHtml(sourceUrl) {
        const response = await this.fetchRemote(sourceUrl, {
            acceptHeader: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            timeoutMs: 10000,
            maxBytes: 3_000_000,
        });
        if (!response.ok)
            (0, http_error_1.throwError)('NOT_FOUND');
        const contentType = (response.headers.get('content-type') ?? '')
            .toLowerCase()
            .trim();
        if (!contentType.includes('text/html'))
            (0, http_error_1.throwError)('NOT_FOUND');
        return {
            html: await response.text(),
            sourceUrl: response.url || sourceUrl,
        };
    }
    async fetchRemoteAsset(sourceUrl, acceptHeader = 'image/*,text/css,*/*;q=0.5') {
        const response = await this.fetchRemote(sourceUrl, {
            acceptHeader,
            timeoutMs: 10000,
            maxBytes: 8_000_000,
        });
        if (!response.ok)
            (0, http_error_1.throwError)('NOT_FOUND');
        const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
        const buffer = Buffer.from(await response.arrayBuffer());
        return {
            buffer,
            contentType,
            sourceUrl: response.url || sourceUrl,
        };
    }
    async fetchRemote(sourceUrl, options) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
        try {
            const response = await fetch(sourceUrl, {
                method: 'GET',
                redirect: 'follow',
                signal: controller.signal,
                headers: {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari',
                    accept: options.acceptHeader,
                },
            });
            const contentLength = Number.parseInt(response.headers.get('content-length') ?? '', 10);
            if (Number.isFinite(contentLength) && contentLength > options.maxBytes) {
                (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'payload_too_large' });
            }
            return response;
        }
        finally {
            clearTimeout(timeout);
        }
    }
    rewriteHtmlForProxy(html, baseUrl) {
        let output = html;
        output = output.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '');
        output = output.replace(/<base\b[^>]*>/gi, '');
        output = output.replace(/<meta[^>]+http-equiv\s*=\s*["']?(?:refresh|content-security-policy)["']?[^>]*>/gi, '');
        output = output.replace(/<script\b[^>]*>/gi, (tag) => this.rewriteScriptTag(tag, baseUrl));
        output = output.replace(/<(img|source|video|audio|track|embed)\b[^>]*>/gi, (tag) => this.rewriteMediaTag(tag, baseUrl));
        output = output.replace(/<link\b[^>]*>/gi, (tag) => this.rewriteLinkTag(tag, baseUrl));
        output = output.replace(/<a\b[^>]*>/gi, (tag) => this.rewriteAnchorTag(tag, baseUrl));
        output = output.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (fullTag, cssContent) => {
            const rewrittenCss = this.rewriteCssForProxy(cssContent, baseUrl);
            return fullTag.replace(cssContent, rewrittenCss);
        });
        output = output.replace(/<[^>]*\sstyle\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)[^>]*>/gi, (tag) => this.rewriteStyleAttribute(tag, baseUrl));
        return output;
    }
    rewriteMediaTag(tag, baseUrl) {
        let nextTag = tag;
        nextTag = this.rewriteTagAttribute(nextTag, 'src', (value) => this.resolveProxyAssetValue(value, baseUrl));
        nextTag = this.rewriteTagAttribute(nextTag, 'poster', (value) => this.resolveProxyAssetValue(value, baseUrl));
        nextTag = this.rewriteTagAttribute(nextTag, 'srcset', (value) => this.rewriteSrcset(value, baseUrl));
        nextTag = this.rewriteTagAttribute(nextTag, 'data-src', (value) => this.resolveProxyAssetValue(value, baseUrl));
        nextTag = this.rewriteTagAttribute(nextTag, 'data-srcset', (value) => this.rewriteSrcset(value, baseUrl));
        return nextTag;
    }
    rewriteScriptTag(tag, baseUrl) {
        let nextTag = this.rewriteTagAttribute(tag, 'src', (value) => this.resolveProxyAssetValue(value, baseUrl));
        nextTag = this.rewriteTagAttribute(nextTag, 'data-src', (value) => this.resolveProxyAssetValue(value, baseUrl));
        nextTag = this.rewriteTagAttribute(nextTag, 'data-href', (value) => this.resolveProxyAssetValue(value, baseUrl));
        nextTag = this.removeTagAttribute(nextTag, 'integrity');
        return nextTag;
    }
    rewriteLinkTag(tag, baseUrl) {
        const attrs = this.parseTagAttributes(tag);
        const rel = String(attrs.rel ?? '').toLowerCase();
        const as = String(attrs.as ?? '').toLowerCase();
        if (this.shouldDropLinkTag(rel)) {
            return '';
        }
        let nextTag = this.rewriteTagAttribute(tag, 'href', (value) => this.resolveProxyAssetValue(value, baseUrl));
        nextTag = this.rewriteTagAttribute(nextTag, 'src', (value) => this.resolveProxyAssetValue(value, baseUrl));
        nextTag = this.rewriteTagAttribute(nextTag, 'data-href', (value) => this.resolveProxyAssetValue(value, baseUrl));
        nextTag = this.rewriteTagAttribute(nextTag, 'data-src', (value) => this.resolveProxyAssetValue(value, baseUrl));
        nextTag = this.rewriteTagAttribute(nextTag, 'imagesrcset', (value) => this.rewriteSrcset(value, baseUrl));
        nextTag = this.rewriteTagAttribute(nextTag, 'srcset', (value) => this.rewriteSrcset(value, baseUrl));
        const stylesheetRel = rel.includes('stylesheet');
        const cssCandidate = attrs.href || attrs['data-href'] || attrs['data-src'];
        if (stylesheetRel && !attrs.href && cssCandidate) {
            const proxied = this.resolveProxyAssetValue(cssCandidate, baseUrl);
            nextTag = this.ensureTagAttribute(nextTag, 'href', proxied);
        }
        if (rel.includes('preload') && as === 'style') {
            nextTag = this.rewriteTagAttribute(nextTag, 'rel', () => 'stylesheet');
            nextTag = this.removeTagAttribute(nextTag, 'as');
        }
        nextTag = this.removeTagAttribute(nextTag, 'integrity');
        return nextTag;
    }
    rewriteAnchorTag(tag, baseUrl) {
        return this.rewriteTagAttribute(tag, 'href', (value) => this.resolveProxyNavigationValue(value, baseUrl));
    }
    shouldDropLinkTag(rel) {
        if (!rel.trim())
            return false;
        return [
            'canonical',
            'alternate',
            'amphtml',
            'shortlink',
            'preconnect',
            'dns-prefetch',
            'pingback',
            'author',
        ].some((value) => rel.includes(value));
    }
    rewriteStyleAttribute(tag, baseUrl) {
        return this.rewriteTagAttribute(tag, 'style', (value) => this.rewriteCssForProxy(value, baseUrl));
    }
    rewriteTagAttribute(tag, attribute, mapValue) {
        const escapedAttribute = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const quotedRegex = new RegExp(`(^|\\s)(${escapedAttribute}\\s*=\\s*)(["'])([^"']*)\\3`, 'i');
        if (quotedRegex.test(tag)) {
            return tag.replace(quotedRegex, (_, leadingSpace, prefix, quote, value) => {
                const nextValue = mapValue(value);
                return `${leadingSpace}${prefix}${quote}${nextValue}${quote}`;
            });
        }
        const unquotedRegex = new RegExp(`(^|\\s)(${escapedAttribute}\\s*=\\s*)([^\\s"'=<>\\\`]+)`, 'i');
        return tag.replace(unquotedRegex, (_, leadingSpace, prefix, value) => {
            const nextValue = mapValue(value);
            return `${leadingSpace}${prefix}"${nextValue}"`;
        });
    }
    removeTagAttribute(tag, attribute) {
        const escapedAttribute = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const quotedRegex = new RegExp(`\\s+${escapedAttribute}\\s*=\\s*(?:"[^"]*"|'[^']*')`, 'gi');
        const unquotedRegex = new RegExp(`\\s+${escapedAttribute}\\s*=\\s*[^\\s"'=<>\\\`]+`, 'gi');
        return tag.replace(quotedRegex, '').replace(unquotedRegex, '');
    }
    ensureTagAttribute(tag, attribute, value) {
        const escapedAttribute = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const attrRegex = new RegExp(`\\b${escapedAttribute}\\s*=`, 'i');
        if (attrRegex.test(tag))
            return tag;
        const normalizedValue = value.replace(/"/g, '&quot;');
        return tag.replace(/>$/, ` ${attribute}="${normalizedValue}">`);
    }
    rewriteSrcset(srcset, baseUrl) {
        const entries = srcset
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean);
        const rewritten = entries.map((entry) => {
            const [rawUrl, ...descriptorParts] = entry.split(/\s+/);
            const nextUrl = this.resolveProxyAssetValue(rawUrl, baseUrl);
            const descriptor = descriptorParts.join(' ').trim();
            return descriptor ? `${nextUrl} ${descriptor}` : nextUrl;
        });
        return rewritten.join(', ');
    }
    rewriteCssForProxy(css, baseUrl) {
        let output = css.replace(/url\(\s*(['"]?)([^"')]+)\1\s*\)/gi, (full, _quote, value) => {
            const nextValue = this.resolveProxyAssetValue(value, baseUrl);
            if (nextValue === value)
                return full;
            return `url("${nextValue}")`;
        });
        output = output.replace(/@import\s+(?:url\(\s*)?(['"]?)([^"')\s]+)\1\s*\)?/gi, (full, _quote, value) => {
            const nextValue = this.resolveProxyAssetValue(value, baseUrl);
            if (nextValue === value)
                return full;
            return `@import url("${nextValue}")`;
        });
        return output;
    }
    rewriteJavascriptForProxy(js, baseUrl) {
        let output = js;
        output = output.replace(/(\bfrom\s*)(['"])([^'"]+)\2/g, (full, prefix, quote, value) => {
            const nextValue = this.resolveProxyAssetValue(value, baseUrl);
            if (nextValue === value)
                return full;
            return `${prefix}${quote}${nextValue}${quote}`;
        });
        output = output.replace(/(\bimport\s*\(\s*)(['"])([^'"]+)\2(\s*\))/g, (full, prefix, quote, value, suffix) => {
            const nextValue = this.resolveProxyAssetValue(value, baseUrl);
            if (nextValue === value)
                return full;
            return `${prefix}${quote}${nextValue}${quote}${suffix}`;
        });
        output = output.replace(/(\bimportScripts\s*\(\s*)(['"])([^'"]+)\2(\s*[,)\n])/g, (full, prefix, quote, value, suffix) => {
            const nextValue = this.resolveProxyAssetValue(value, baseUrl);
            if (nextValue === value)
                return full;
            return `${prefix}${quote}${nextValue}${quote}${suffix}`;
        });
        return output;
    }
    resolveProxyAssetValue(value, baseUrl) {
        const resolved = this.resolveResourceUrl(value, baseUrl);
        if (!resolved)
            return value;
        return this.buildAssetProxyPath(resolved);
    }
    resolveProxyNavigationValue(value, baseUrl) {
        const resolved = this.resolveResourceUrl(value, baseUrl);
        if (!resolved)
            return value;
        if (this.isLikelyBinaryAsset(resolved)) {
            return this.buildAssetProxyPath(resolved);
        }
        return this.buildPageProxyPath(resolved);
    }
    isLikelyBinaryAsset(url) {
        return /\.(pdf|csv|txt|xml|json|zip|rar|7z|gz|doc|docx|xls|xlsx|ppt|pptx|jpg|jpeg|png|gif|webp|svg|ico|mp3|wav|ogg|mp4|webm|mov|avi)(?:$|[?#])/i.test(url);
    }
    resolveResourceUrl(value, baseUrl) {
        const normalized = (0, sanitize_1.sanitizeText)(value ?? '');
        if (!normalized)
            return null;
        const lowered = normalized.toLowerCase();
        if (lowered.startsWith('data:') ||
            lowered.startsWith('blob:') ||
            lowered.startsWith('javascript:') ||
            lowered.startsWith('#')) {
            return null;
        }
        try {
            const resolved = new URL(normalized, baseUrl);
            if (!['http:', 'https:'].includes(resolved.protocol))
                return null;
            return resolved.toString();
        }
        catch {
            return null;
        }
    }
    normalizeRequiredText(value, field) {
        const normalized = (0, sanitize_1.sanitizeText)(value ?? '');
        if (!normalized) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field, reason: 'required' });
        }
        return normalized;
    }
    normalizeOptionalText(value) {
        if (value === null)
            return null;
        if (value === undefined)
            return undefined;
        const normalized = (0, sanitize_1.sanitizeText)(value);
        return normalized || null;
    }
    normalizeTags(values) {
        if (values === undefined || values === null)
            return undefined;
        const seen = new Set();
        const normalized = [];
        for (const value of values) {
            const clean = (0, sanitize_1.sanitizeText)(value ?? '').toLowerCase();
            if (!clean || seen.has(clean))
                continue;
            seen.add(clean);
            normalized.push(clean);
            if (normalized.length >= 30)
                break;
        }
        return normalized;
    }
    normalizeUrl(value, field) {
        const normalized = (0, sanitize_1.sanitizeText)(value ?? '');
        if (!normalized) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field, reason: 'required' });
        }
        let url;
        try {
            url = new URL(normalized);
        }
        catch {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field, reason: 'invalid_url' });
        }
        if (!['http:', 'https:'].includes(url.protocol)) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field, reason: 'invalid_protocol' });
        }
        return url.toString();
    }
    resolveCoverUrl(value, sourceUrl) {
        if (value === undefined)
            return undefined;
        if (value === null)
            return null;
        const normalized = (0, sanitize_1.sanitizeText)(value);
        if (!normalized)
            return null;
        if (normalized.startsWith('/social-communication/uploads/')) {
            return normalized;
        }
        try {
            const resolved = new URL(normalized, sourceUrl);
            if (!['http:', 'https:'].includes(resolved.protocol)) {
                return null;
            }
            return resolved.toString();
        }
        catch {
            return null;
        }
    }
    parseOptionalDate(value, field) {
        if (value === undefined)
            return undefined;
        if (value === null)
            return null;
        const normalized = (0, sanitize_1.sanitizeText)(value);
        if (!normalized)
            return null;
        const parsed = new Date(normalized);
        if (Number.isNaN(parsed.getTime())) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { field, reason: 'invalid_date' });
        }
        return parsed;
    }
    buildFallbackTitle(sourceUrl) {
        try {
            const host = new URL(sourceUrl).hostname.replace(/^www\./i, '');
            return host || 'Materia';
        }
        catch {
            return 'Materia';
        }
    }
    async extractMetadataSafe(sourceUrl) {
        try {
            return await this.extractMetadata(sourceUrl);
        }
        catch {
            return {};
        }
    }
    async extractMetadata(sourceUrl) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6500);
        try {
            const response = await fetch(sourceUrl, {
                method: 'GET',
                redirect: 'follow',
                signal: controller.signal,
                headers: {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari',
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
            });
            if (!response.ok)
                return {};
            const contentType = response.headers.get('content-type') ?? '';
            if (!contentType.toLowerCase().includes('text/html'))
                return {};
            const html = await response.text();
            const metaMap = this.extractMetaMap(html);
            const title = this.firstNonEmpty(metaMap.get('og:title'), metaMap.get('twitter:title'), this.extractTitleTag(html));
            const coverImageUrl = this.firstNonEmpty(metaMap.get('og:image:secure_url'), metaMap.get('og:image:url'), metaMap.get('og:image'), metaMap.get('twitter:image'));
            const summary = this.firstNonEmpty(metaMap.get('og:description'), metaMap.get('description'), metaMap.get('twitter:description'));
            const publishedAt = this.firstNonEmpty(metaMap.get('article:published_time'), metaMap.get('published_time'), metaMap.get('pubdate'), metaMap.get('date'));
            return { title, coverImageUrl, summary, publishedAt };
        }
        finally {
            clearTimeout(timeout);
        }
    }
    extractMetaMap(html) {
        const metaMap = new Map();
        const tags = html.match(/<meta\s+[^>]*>/gi) ?? [];
        for (const tag of tags) {
            const attrs = this.parseTagAttributes(tag);
            const keyRaw = attrs.property ?? attrs.name;
            const contentRaw = attrs.content;
            if (!keyRaw || !contentRaw)
                continue;
            const key = keyRaw.trim().toLowerCase();
            const content = this.decodeHtmlEntities(contentRaw.trim());
            if (!key || !content)
                continue;
            if (!metaMap.has(key))
                metaMap.set(key, content);
        }
        return metaMap;
    }
    parseTagAttributes(tag) {
        const attrs = {};
        const attrRegex = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
        let match;
        while ((match = attrRegex.exec(tag)) !== null) {
            const name = (match[1] ?? '').trim().toLowerCase();
            if (!name)
                continue;
            const value = match[2] ?? match[3] ?? match[4] ?? '';
            attrs[name] = value;
        }
        return attrs;
    }
    extractTitleTag(html) {
        const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        if (!match?.[1])
            return undefined;
        const value = match[1].replace(/\s+/g, ' ').trim();
        return this.decodeHtmlEntities(value) || undefined;
    }
    firstNonEmpty(...values) {
        for (const value of values) {
            if (!value)
                continue;
            const normalized = (0, sanitize_1.sanitizeText)(value);
            if (normalized)
                return normalized;
        }
        return undefined;
    }
    decodeHtmlEntities(value) {
        return value
            .replace(/&amp;/gi, '&')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;|&apos;/gi, "'")
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>');
    }
};
exports.SocialCommunicationService = SocialCommunicationService;
exports.SocialCommunicationService = SocialCommunicationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        config_1.ConfigService])
], SocialCommunicationService);
//# sourceMappingURL=social-communication.service.js.map