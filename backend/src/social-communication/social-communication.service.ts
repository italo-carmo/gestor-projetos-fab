import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AuditService } from '../audit/audit.service';
import { throwError } from '../common/http-error';
import { sanitizeText } from '../common/sanitize';
import { PrismaService } from '../prisma/prisma.service';
import {
  hasAnyRole,
  ROLE_COMANDANTE_COMGEP,
  ROLE_COORDENACAO_CIPAVD,
  ROLE_TI,
} from '../rbac/role-access';
import type { RbacUser } from '../rbac/rbac.types';
import { FabLdapService } from '../ldap/fab-ldap.service';
import { getSocialCommunicationCoverCandidates } from './social-communication-storage';

type MetadataExtraction = {
  title?: string;
  coverImageUrl?: string;
  summary?: string;
  publishedAt?: string;
};

type HighlightImpact = 'MULTIPLICADOR' | 'SIMBOLICO';

@Injectable()
export class SocialCommunicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly fabLdap: FabLdapService,
  ) {}

  async list(filters: { q?: string; tags?: string[] }) {
    const where: Prisma.SocialCommunicationArticleWhereInput = {};
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

  async listHighlights(filters: { q?: string }) {
    const where: any = {};
    const normalizedQuery = sanitizeText(filters.q ?? '');
    if (normalizedQuery) {
      where.OR = [
        { militaryName: { contains: normalizedQuery, mode: 'insensitive' } },
        { highlightRole: { contains: normalizedQuery, mode: 'insensitive' } },
        { militaryEmail: { contains: normalizedQuery, mode: 'insensitive' } },
        { fabom: { contains: normalizedQuery, mode: 'insensitive' } },
        { highlightText: { contains: normalizedQuery, mode: 'insensitive' } },
        {
          locality: {
            name: { contains: normalizedQuery, mode: 'insensitive' },
          },
        },
        {
          locality: {
            code: { contains: normalizedQuery, mode: 'insensitive' },
          },
        },
      ];
    }

    const rows = await (
      this.prisma as any
    ).socialCommunicationHighlight.findMany({
      where,
      include: {
        locality: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return {
      items: rows.map((item: any) => this.toHighlightResponse(item)),
    };
  }

  async lookupHighlightLdapProfile(email: string, user?: RbacUser) {
    this.assertHighlightEditorAccess(user);

    const normalizedEmail = this.normalizeHighlightEmail(email, 'email');
    const profile = await this.fabLdap.lookupByEmail(normalizedEmail);
    if (!profile) {
      throwError('VALIDATION_ERROR', {
        field: 'email',
        reason: 'ldap_user_not_found',
      });
    }

    return {
      uid: profile.uid ?? null,
      name: profile.name ?? null,
      email: profile.email ?? normalizedEmail,
      fabom: profile.fabom ?? null,
      numeroOrdem: profile.numeroOrdem ?? null,
    };
  }

  async createHighlight(
    payload: {
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
    },
    user?: RbacUser,
  ) {
    this.assertHighlightEditorAccess(user);

    const localityId = this.normalizeRequiredText(
      payload.localityId,
      'localityId',
    );
    await this.assertHighlightLocalityExists(localityId);
    const normalizedPhotoBase64 =
      this.normalizeHighlightPhotoBase64(payload.photoBase64, 'photoBase64') ??
      null;
    const normalizedPhotoMimeType = normalizedPhotoBase64
      ? (this.normalizeHighlightPhotoMimeType(
          payload.photoMimeType,
          'photoMimeType',
        ) ?? 'image/jpeg')
      : null;

    const created = await (
      this.prisma as any
    ).socialCommunicationHighlight.create({
      data: {
        ldapUid: this.normalizeOptionalText(payload.ldapUid) ?? null,
        militaryEmail: this.normalizeHighlightEmail(
          payload.militaryEmail,
          'militaryEmail',
        ),
        militaryName: this.normalizeRequiredText(
          payload.militaryName,
          'militaryName',
        ),
        highlightRole:
          this.normalizeOptionalText(payload.highlightRole) ?? null,
        fabom: this.normalizeOptionalText(payload.fabom) ?? null,
        photoMimeType: normalizedPhotoMimeType,
        photoBase64: normalizedPhotoBase64,
        impact: this.normalizeHighlightImpact(payload.impact, 'impact'),
        localityId,
        highlightText: this.normalizeHighlightText(payload.text, 'text'),
        createdById: user?.id ?? null,
      },
      include: {
        locality: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'social_communication_highlight',
      action: 'create',
      entityId: created.id,
      diffJson: {
        militaryName: created.militaryName,
        militaryEmail: created.militaryEmail,
        impact: created.impact,
      },
    });

    return this.toHighlightResponse(created);
  }

  async updateHighlight(
    id: string,
    payload: {
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
    },
    user?: RbacUser,
  ) {
    this.assertHighlightEditorAccess(user);

    const existing = await (
      this.prisma as any
    ).socialCommunicationHighlight.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throwError('NOT_FOUND');

    const data: any = {};

    if (payload.ldapUid !== undefined) {
      data.ldapUid = this.normalizeOptionalText(payload.ldapUid) ?? null;
    }
    if (payload.militaryEmail !== undefined) {
      data.militaryEmail = this.normalizeHighlightEmail(
        payload.militaryEmail,
        'militaryEmail',
      );
    }
    if (payload.militaryName !== undefined) {
      data.militaryName = this.normalizeRequiredText(
        payload.militaryName,
        'militaryName',
      );
    }
    if (payload.fabom !== undefined) {
      data.fabom = this.normalizeOptionalText(payload.fabom) ?? null;
    }
    if (payload.highlightRole !== undefined) {
      data.highlightRole =
        this.normalizeOptionalText(payload.highlightRole) ?? null;
    }
    if (payload.photoBase64 !== undefined) {
      const normalizedPhotoBase64 = this.normalizeHighlightPhotoBase64(
        payload.photoBase64,
        'photoBase64',
      );
      if (normalizedPhotoBase64) {
        data.photoBase64 = normalizedPhotoBase64;
        data.photoMimeType =
          this.normalizeHighlightPhotoMimeType(
            payload.photoMimeType,
            'photoMimeType',
          ) ?? 'image/jpeg';
      } else {
        data.photoBase64 = null;
        data.photoMimeType = null;
      }
    } else if (payload.photoMimeType !== undefined) {
      data.photoMimeType =
        this.normalizeHighlightPhotoMimeType(
          payload.photoMimeType,
          'photoMimeType',
        ) ?? null;
    }
    if (payload.impact !== undefined) {
      data.impact = this.normalizeHighlightImpact(payload.impact, 'impact');
    }
    if (payload.localityId !== undefined) {
      const localityId = this.normalizeRequiredText(
        payload.localityId,
        'localityId',
      );
      await this.assertHighlightLocalityExists(localityId);
      data.locality = { connect: { id: localityId } };
    }
    if (payload.text !== undefined) {
      data.highlightText = this.normalizeHighlightText(payload.text, 'text');
    }

    const updated = await (
      this.prisma as any
    ).socialCommunicationHighlight.update({
      where: { id },
      data,
      include: {
        locality: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'social_communication_highlight',
      action: 'update',
      entityId: id,
      diffJson: {
        militaryName: updated.militaryName,
        militaryEmail: updated.militaryEmail,
        impact: updated.impact,
      },
    });

    return this.toHighlightResponse(updated);
  }

  async removeHighlight(id: string, user?: RbacUser) {
    this.assertHighlightEditorAccess(user);

    const existing = await (
      this.prisma as any
    ).socialCommunicationHighlight.findUnique({
      where: { id },
      select: { id: true, militaryName: true, militaryEmail: true },
    });
    if (!existing) throwError('NOT_FOUND');

    await (this.prisma as any).socialCommunicationHighlight.delete({
      where: { id },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'social_communication_highlight',
      action: 'delete',
      entityId: id,
      diffJson: {
        militaryName: existing.militaryName,
        militaryEmail: existing.militaryEmail,
      },
    });

    return { ok: true };
  }

  async create(
    payload: {
      url: string;
      title?: string;
      coverImageUrl?: string | null;
      summary?: string | null;
      publishedAt?: string | null;
      tags?: string[];
      audience?: 'INTERNAL' | 'EXTERNAL';
    },
    user?: RbacUser,
  ) {
    this.assertEditorAccess(user);

    const sourceUrl = this.normalizeUrl(payload.url, 'url');
    const metadata = await this.extractMetadataSafe(sourceUrl);

    const created = await this.prisma.socialCommunicationArticle.create({
      data: {
        sourceUrl,
        title: this.normalizeRequiredText(
          payload.title ?? metadata.title ?? this.buildFallbackTitle(sourceUrl),
          'title',
        ),
        coverImageUrl: this.resolveCoverUrl(
          payload.coverImageUrl ?? metadata.coverImageUrl ?? null,
          sourceUrl,
        ),
        summary: this.normalizeOptionalText(
          payload.summary ?? metadata.summary ?? null,
        ),
        tags: this.normalizeTags(payload.tags) ?? [],
        audience: payload.audience ?? 'INTERNAL',
        publishedAt: this.parseOptionalDate(
          payload.publishedAt ?? metadata.publishedAt ?? null,
          'publishedAt',
        ),
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

  async update(
    id: string,
    payload: {
      url?: string;
      title?: string;
      coverImageUrl?: string | null;
      summary?: string | null;
      publishedAt?: string | null;
      tags?: string[];
      audience?: 'INTERNAL' | 'EXTERNAL';
    },
    user?: RbacUser,
  ) {
    this.assertEditorAccess(user);

    const existing = await this.prisma.socialCommunicationArticle.findUnique({
      where: { id },
    });
    if (!existing) throwError('NOT_FOUND');

    const sourceUrl = payload.url
      ? this.normalizeUrl(payload.url, 'url')
      : existing.sourceUrl;
    const sourceUrlChanged = sourceUrl !== existing.sourceUrl;
    const metadata: MetadataExtraction = sourceUrlChanged
      ? await this.extractMetadataSafe(sourceUrl)
      : {};

    const title =
      payload.title !== undefined
        ? this.normalizeRequiredText(payload.title, 'title')
        : sourceUrlChanged
          ? this.normalizeRequiredText(
              metadata.title ??
                existing.title ??
                this.buildFallbackTitle(sourceUrl),
              'title',
            )
          : undefined;

    let coverImageUrl: string | null | undefined;
    if (payload.coverImageUrl !== undefined) {
      coverImageUrl = this.resolveCoverUrl(payload.coverImageUrl, sourceUrl);
    } else if (sourceUrlChanged) {
      coverImageUrl =
        this.resolveCoverUrl(metadata.coverImageUrl ?? null, sourceUrl) ??
        existing.coverImageUrl ??
        null;
    }

    const summary =
      payload.summary !== undefined
        ? this.normalizeOptionalText(payload.summary)
        : sourceUrlChanged
          ? this.normalizeOptionalText(
              metadata.summary ?? existing.summary ?? null,
            )
          : undefined;

    const publishedAt =
      payload.publishedAt !== undefined
        ? this.parseOptionalDate(payload.publishedAt, 'publishedAt')
        : sourceUrlChanged
          ? (this.parseOptionalDate(
              metadata.publishedAt ?? null,
              'publishedAt',
            ) ??
            existing.publishedAt ??
            null)
          : undefined;
    const tags =
      payload.tags !== undefined
        ? (this.normalizeTags(payload.tags) ?? [])
        : undefined;
    const audience =
      payload.audience !== undefined ? payload.audience : undefined;

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

  async remove(id: string, user?: RbacUser) {
    this.assertEditorAccess(user);

    const existing = await this.prisma.socialCommunicationArticle.findUnique({
      where: { id },
    });
    if (!existing) throwError('NOT_FOUND');

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

  async resolveMetadata(url: string, user?: RbacUser) {
    this.assertEditorAccess(user);

    const sourceUrl = this.normalizeUrl(url, 'url');
    const metadata = await this.extractMetadataSafe(sourceUrl);

    const title = this.normalizeRequiredText(
      metadata.title ?? this.buildFallbackTitle(sourceUrl),
      'title',
    );

    return {
      url: sourceUrl,
      title,
      coverImageUrl: this.resolveCoverUrl(
        metadata.coverImageUrl ?? null,
        sourceUrl,
      ),
      summary: this.normalizeOptionalText(metadata.summary ?? null),
      publishedAt:
        this.parseOptionalDate(
          metadata.publishedAt ?? null,
          'publishedAt',
        )?.toISOString() ?? null,
    };
  }

  async getPublicContent(articleId: string, exp: string, sig: string) {
    const normalizedId = sanitizeText(articleId);
    if (!normalizedId) {
      throwError('NOT_FOUND');
    }
    this.assertProxySignature('content', normalizedId, exp, sig);

    const article = await this.prisma.socialCommunicationArticle.findUnique({
      where: { id: normalizedId },
      select: { id: true, sourceUrl: true },
    });
    if (!article) throwError('NOT_FOUND');

    const payload = await this.fetchRemoteHtml(article.sourceUrl);
    const html = this.rewriteHtmlForProxy(payload.html, payload.sourceUrl);
    return { html };
  }

  async getPublicCover(articleId: string, exp: string, sig: string) {
    const normalizedId = sanitizeText(articleId);
    if (!normalizedId) {
      throwError('NOT_FOUND');
    }
    this.assertProxySignature('cover', normalizedId, exp, sig);

    const article = await this.prisma.socialCommunicationArticle.findUnique({
      where: { id: normalizedId },
      select: { coverImageUrl: true },
    });
    if (!article?.coverImageUrl) throwError('NOT_FOUND');

    if (article.coverImageUrl.startsWith('/social-communication/uploads/')) {
      const filename = path.basename(article.coverImageUrl);
      const filePath = getSocialCommunicationCoverCandidates(filename).find(
        (candidate) => fs.existsSync(candidate),
      );
      if (!filePath) throwError('NOT_FOUND');
      const buffer = fs.readFileSync(filePath);
      const extension = path.extname(filename).toLowerCase();
      const contentType =
        extension === '.png'
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
      return await this.fetchRemoteAsset(
        article.coverImageUrl,
        'image/*,*/*;q=0.8',
      );
    } catch {
      // Se falhar ao buscar via proxy, retorna erro para que o frontend tente URL direta.
      throwError('NOT_FOUND');
    }
  }

  async getPublicAsset(url: string, exp: string, sig: string) {
    const normalizedUrl = this.normalizeUrl(url, 'url');
    this.assertProxySignature('asset', normalizedUrl, exp, sig);
    const payload = await this.fetchRemoteAsset(normalizedUrl);
    const contentTypeLower = payload.contentType.toLowerCase();
    const isCss =
      contentTypeLower.includes('text/css') ||
      /\.css(?:$|[?#])/i.test(payload.sourceUrl);
    const isJavascript =
      contentTypeLower.includes('javascript') ||
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

  async getPublicPage(url: string, exp: string, sig: string) {
    const normalizedUrl = this.normalizeUrl(url, 'url');
    this.assertProxySignature('page', normalizedUrl, exp, sig);
    const payload = await this.fetchRemoteHtml(normalizedUrl);
    const html = this.rewriteHtmlForProxy(payload.html, payload.sourceUrl);
    return { html };
  }

  ensureEditorAccess(user?: RbacUser) {
    this.assertEditorAccess(user);
  }

  private assertHighlightEditorAccess(user?: RbacUser) {
    if (!hasAnyRole(user, [ROLE_COORDENACAO_CIPAVD, ROLE_TI])) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private assertEditorAccess(user?: RbacUser) {
    if (
      !hasAnyRole(user, [
        ROLE_COORDENACAO_CIPAVD,
        ROLE_COMANDANTE_COMGEP,
        ROLE_TI,
      ])
    ) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private buildContentProxyPath(articleId: string) {
    const signature = this.createProxySignature('content', articleId);
    return `/social-communication/proxy/content?articleId=${encodeURIComponent(
      articleId,
    )}&exp=${signature.exp}&sig=${encodeURIComponent(signature.sig)}`;
  }

  private buildCoverProxyPath(articleId: string) {
    const signature = this.createProxySignature('cover', articleId);
    return `/social-communication/proxy/cover?articleId=${encodeURIComponent(
      articleId,
    )}&exp=${signature.exp}&sig=${encodeURIComponent(signature.sig)}`;
  }

  private buildAssetProxyPath(url: string) {
    const normalizedUrl = this.normalizeUrl(url, 'url');
    const signature = this.createProxySignature('asset', normalizedUrl);
    // Use a relative path so requests remain under the same /api proxy base
    // regardless of deployment path (e.g. /api/social-communication/...).
    return `asset?url=${encodeURIComponent(
      normalizedUrl,
    )}&exp=${signature.exp}&sig=${encodeURIComponent(signature.sig)}`;
  }

  private buildPageProxyPath(url: string) {
    const normalizedUrl = this.normalizeUrl(url, 'url');
    const signature = this.createProxySignature('page', normalizedUrl);
    // Keep article navigations inside the proxied context.
    return `page?url=${encodeURIComponent(
      normalizedUrl,
    )}&exp=${signature.exp}&sig=${encodeURIComponent(signature.sig)}`;
  }

  private createProxySignature(
    type: 'content' | 'cover' | 'asset' | 'page',
    value: string,
  ) {
    const exp = Date.now() + 1000 * 60 * 60 * 12;
    const payload = `${type}|${value}|${exp}`;
    return {
      exp: String(exp),
      sig: this.signProxyPayload(payload),
    };
  }

  private assertProxySignature(
    type: 'content' | 'cover' | 'asset' | 'page',
    value: string,
    expRaw: string,
    sig: string,
  ) {
    const exp = Number.parseInt(String(expRaw ?? '').trim(), 10);
    if (!Number.isFinite(exp) || exp <= Date.now()) {
      throwError('RBAC_FORBIDDEN');
    }

    const expectedSig = this.signProxyPayload(`${type}|${value}|${exp}`);
    if (!this.safeEqual(expectedSig, String(sig ?? '').trim())) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private signProxyPayload(payload: string) {
    return createHmac('sha256', this.getProxySecret())
      .update(payload)
      .digest('base64url');
  }

  private safeEqual(a: string, b: string) {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  }

  private getProxySecret() {
    return (
      this.config.get<string>('SOCIAL_COMM_PROXY_SECRET') ||
      this.config.get<string>('JWT_SECRET') ||
      'cipavd-social-communication-proxy'
    );
  }

  private async fetchRemoteHtml(sourceUrl: string) {
    const response = await this.fetchRemote(sourceUrl, {
      acceptHeader:
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      timeoutMs: 10000,
      maxBytes: 3_000_000,
    });
    if (!response.ok) throwError('NOT_FOUND');

    const contentType = (response.headers.get('content-type') ?? '')
      .toLowerCase()
      .trim();
    if (!contentType.includes('text/html')) throwError('NOT_FOUND');

    return {
      html: await response.text(),
      sourceUrl: response.url || sourceUrl,
    };
  }

  private async fetchRemoteAsset(
    sourceUrl: string,
    acceptHeader = 'image/*,text/css,*/*;q=0.5',
  ) {
    const response = await this.fetchRemote(sourceUrl, {
      acceptHeader,
      timeoutMs: 10000,
      maxBytes: 8_000_000,
    });
    if (!response.ok) throwError('NOT_FOUND');

    const contentType =
      response.headers.get('content-type') ?? 'application/octet-stream';
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      buffer,
      contentType,
      sourceUrl: response.url || sourceUrl,
    };
  }

  private async fetchRemote(
    sourceUrl: string,
    options: { acceptHeader: string; timeoutMs: number; maxBytes: number },
  ) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const response = await fetch(sourceUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari',
          accept: options.acceptHeader,
        },
      });

      const contentLength = Number.parseInt(
        response.headers.get('content-length') ?? '',
        10,
      );
      if (Number.isFinite(contentLength) && contentLength > options.maxBytes) {
        throwError('VALIDATION_ERROR', { reason: 'payload_too_large' });
      }

      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  private rewriteHtmlForProxy(html: string, baseUrl: string) {
    let output = html;
    output = output.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '');
    output = output.replace(/<base\b[^>]*>/gi, '');
    output = output.replace(
      /<meta[^>]+http-equiv\s*=\s*["']?(?:refresh|content-security-policy)["']?[^>]*>/gi,
      '',
    );
    output = output.replace(/<script\b[^>]*>/gi, (tag) =>
      this.rewriteScriptTag(tag, baseUrl),
    );
    output = output.replace(
      /<(img|source|video|audio|track|embed)\b[^>]*>/gi,
      (tag) => this.rewriteMediaTag(tag, baseUrl),
    );
    output = output.replace(/<link\b[^>]*>/gi, (tag) =>
      this.rewriteLinkTag(tag, baseUrl),
    );
    output = output.replace(/<a\b[^>]*>/gi, (tag) =>
      this.rewriteAnchorTag(tag, baseUrl),
    );
    output = output.replace(
      /<style\b[^>]*>([\s\S]*?)<\/style>/gi,
      (fullTag: string, cssContent: string) => {
        const rewrittenCss = this.rewriteCssForProxy(cssContent, baseUrl);
        return fullTag.replace(cssContent, rewrittenCss);
      },
    );
    output = output.replace(
      /<[^>]*\sstyle\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)[^>]*>/gi,
      (tag) => this.rewriteStyleAttribute(tag, baseUrl),
    );
    return output;
  }

  private rewriteMediaTag(tag: string, baseUrl: string) {
    let nextTag = tag;
    nextTag = this.rewriteTagAttribute(nextTag, 'src', (value) =>
      this.resolveProxyAssetValue(value, baseUrl),
    );
    nextTag = this.rewriteTagAttribute(nextTag, 'poster', (value) =>
      this.resolveProxyAssetValue(value, baseUrl),
    );
    nextTag = this.rewriteTagAttribute(nextTag, 'srcset', (value) =>
      this.rewriteSrcset(value, baseUrl),
    );
    nextTag = this.rewriteTagAttribute(nextTag, 'data-src', (value) =>
      this.resolveProxyAssetValue(value, baseUrl),
    );
    nextTag = this.rewriteTagAttribute(nextTag, 'data-srcset', (value) =>
      this.rewriteSrcset(value, baseUrl),
    );
    return nextTag;
  }

  private rewriteScriptTag(tag: string, baseUrl: string) {
    let nextTag = this.rewriteTagAttribute(tag, 'src', (value) =>
      this.resolveProxyAssetValue(value, baseUrl),
    );
    nextTag = this.rewriteTagAttribute(nextTag, 'data-src', (value) =>
      this.resolveProxyAssetValue(value, baseUrl),
    );
    nextTag = this.rewriteTagAttribute(nextTag, 'data-href', (value) =>
      this.resolveProxyAssetValue(value, baseUrl),
    );
    nextTag = this.removeTagAttribute(nextTag, 'integrity');
    return nextTag;
  }

  private rewriteLinkTag(tag: string, baseUrl: string) {
    const attrs = this.parseTagAttributes(tag);
    const rel = String(attrs.rel ?? '').toLowerCase();
    const as = String(attrs.as ?? '').toLowerCase();

    if (this.shouldDropLinkTag(rel)) {
      return '';
    }

    let nextTag = this.rewriteTagAttribute(tag, 'href', (value) =>
      this.resolveProxyAssetValue(value, baseUrl),
    );
    nextTag = this.rewriteTagAttribute(nextTag, 'src', (value) =>
      this.resolveProxyAssetValue(value, baseUrl),
    );
    nextTag = this.rewriteTagAttribute(nextTag, 'data-href', (value) =>
      this.resolveProxyAssetValue(value, baseUrl),
    );
    nextTag = this.rewriteTagAttribute(nextTag, 'data-src', (value) =>
      this.resolveProxyAssetValue(value, baseUrl),
    );
    nextTag = this.rewriteTagAttribute(nextTag, 'imagesrcset', (value) =>
      this.rewriteSrcset(value, baseUrl),
    );
    nextTag = this.rewriteTagAttribute(nextTag, 'srcset', (value) =>
      this.rewriteSrcset(value, baseUrl),
    );

    // Some sites lazy-load CSS via data-src/data-href; set href directly to avoid style loss.
    const stylesheetRel = rel.includes('stylesheet');
    const cssCandidate = attrs.href || attrs['data-href'] || attrs['data-src'];
    if (stylesheetRel && !attrs.href && cssCandidate) {
      const proxied = this.resolveProxyAssetValue(cssCandidate, baseUrl);
      nextTag = this.ensureTagAttribute(nextTag, 'href', proxied);
    }
    if (rel.includes('preload') && as === 'style') {
      // Apply preload style sheets immediately to avoid unstyled documents.
      nextTag = this.rewriteTagAttribute(nextTag, 'rel', () => 'stylesheet');
      nextTag = this.removeTagAttribute(nextTag, 'as');
    }

    nextTag = this.removeTagAttribute(nextTag, 'integrity');
    return nextTag;
  }

  private rewriteAnchorTag(tag: string, baseUrl: string) {
    return this.rewriteTagAttribute(tag, 'href', (value) =>
      this.resolveProxyNavigationValue(value, baseUrl),
    );
  }

  private shouldDropLinkTag(rel: string) {
    if (!rel.trim()) return false;
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

  private rewriteStyleAttribute(tag: string, baseUrl: string) {
    return this.rewriteTagAttribute(tag, 'style', (value) =>
      this.rewriteCssForProxy(value, baseUrl),
    );
  }

  private rewriteTagAttribute(
    tag: string,
    attribute: string,
    mapValue: (value: string) => string,
  ) {
    const escapedAttribute = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const quotedRegex = new RegExp(
      `(^|\\s)(${escapedAttribute}\\s*=\\s*)(["'])([^"']*)\\3`,
      'i',
    );
    if (quotedRegex.test(tag)) {
      return tag.replace(
        quotedRegex,
        (
          _,
          leadingSpace: string,
          prefix: string,
          quote: string,
          value: string,
        ) => {
          const nextValue = mapValue(value);
          return `${leadingSpace}${prefix}${quote}${nextValue}${quote}`;
        },
      );
    }

    const unquotedRegex = new RegExp(
      `(^|\\s)(${escapedAttribute}\\s*=\\s*)([^\\s"'=<>\\\`]+)`,
      'i',
    );
    return tag.replace(
      unquotedRegex,
      (_, leadingSpace: string, prefix: string, value: string) => {
        const nextValue = mapValue(value);
        return `${leadingSpace}${prefix}"${nextValue}"`;
      },
    );
  }

  private removeTagAttribute(tag: string, attribute: string) {
    const escapedAttribute = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const quotedRegex = new RegExp(
      `\\s+${escapedAttribute}\\s*=\\s*(?:"[^"]*"|'[^']*')`,
      'gi',
    );
    const unquotedRegex = new RegExp(
      `\\s+${escapedAttribute}\\s*=\\s*[^\\s"'=<>\\\`]+`,
      'gi',
    );
    return tag.replace(quotedRegex, '').replace(unquotedRegex, '');
  }

  private ensureTagAttribute(tag: string, attribute: string, value: string) {
    const escapedAttribute = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const attrRegex = new RegExp(`\\b${escapedAttribute}\\s*=`, 'i');
    if (attrRegex.test(tag)) return tag;
    const normalizedValue = value.replace(/"/g, '&quot;');
    return tag.replace(/>$/, ` ${attribute}="${normalizedValue}">`);
  }

  private rewriteSrcset(srcset: string, baseUrl: string) {
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

  private rewriteCssForProxy(css: string, baseUrl: string) {
    let output = css.replace(
      /url\(\s*(['"]?)([^"')]+)\1\s*\)/gi,
      (full: string, _quote: string, value: string) => {
        const nextValue = this.resolveProxyAssetValue(value, baseUrl);
        if (nextValue === value) return full;
        return `url("${nextValue}")`;
      },
    );

    output = output.replace(
      /@import\s+(?:url\(\s*)?(['"]?)([^"')\s]+)\1\s*\)?/gi,
      (full: string, _quote: string, value: string) => {
        const nextValue = this.resolveProxyAssetValue(value, baseUrl);
        if (nextValue === value) return full;
        return `@import url("${nextValue}")`;
      },
    );

    return output;
  }

  private rewriteJavascriptForProxy(js: string, baseUrl: string) {
    let output = js;

    output = output.replace(
      /(\bfrom\s*)(['"])([^'"]+)\2/g,
      (full: string, prefix: string, quote: string, value: string) => {
        const nextValue = this.resolveProxyAssetValue(value, baseUrl);
        if (nextValue === value) return full;
        return `${prefix}${quote}${nextValue}${quote}`;
      },
    );

    output = output.replace(
      /(\bimport\s*\(\s*)(['"])([^'"]+)\2(\s*\))/g,
      (
        full: string,
        prefix: string,
        quote: string,
        value: string,
        suffix: string,
      ) => {
        const nextValue = this.resolveProxyAssetValue(value, baseUrl);
        if (nextValue === value) return full;
        return `${prefix}${quote}${nextValue}${quote}${suffix}`;
      },
    );

    output = output.replace(
      /(\bimportScripts\s*\(\s*)(['"])([^'"]+)\2(\s*[,)\n])/g,
      (
        full: string,
        prefix: string,
        quote: string,
        value: string,
        suffix: string,
      ) => {
        const nextValue = this.resolveProxyAssetValue(value, baseUrl);
        if (nextValue === value) return full;
        return `${prefix}${quote}${nextValue}${quote}${suffix}`;
      },
    );

    return output;
  }

  private resolveProxyAssetValue(value: string, baseUrl: string) {
    const resolved = this.resolveResourceUrl(value, baseUrl);
    if (!resolved) return value;
    return this.buildAssetProxyPath(resolved);
  }

  private resolveProxyNavigationValue(value: string, baseUrl: string) {
    const resolved = this.resolveResourceUrl(value, baseUrl);
    if (!resolved) return value;
    if (this.isLikelyBinaryAsset(resolved)) {
      return this.buildAssetProxyPath(resolved);
    }
    return this.buildPageProxyPath(resolved);
  }

  private isLikelyBinaryAsset(url: string) {
    return /\.(pdf|csv|txt|xml|json|zip|rar|7z|gz|doc|docx|xls|xlsx|ppt|pptx|jpg|jpeg|png|gif|webp|svg|ico|mp3|wav|ogg|mp4|webm|mov|avi)(?:$|[?#])/i.test(
      url,
    );
  }

  private resolveResourceUrl(value: string, baseUrl: string) {
    const normalized = sanitizeText(value ?? '');
    if (!normalized) return null;
    const lowered = normalized.toLowerCase();
    if (
      lowered.startsWith('data:') ||
      lowered.startsWith('blob:') ||
      lowered.startsWith('javascript:') ||
      lowered.startsWith('#')
    ) {
      return null;
    }

    try {
      const resolved = new URL(normalized, baseUrl);
      if (!['http:', 'https:'].includes(resolved.protocol)) return null;
      return resolved.toString();
    } catch {
      return null;
    }
  }

  private toHighlightResponse(item: {
    id: string;
    ldapUid: string | null;
    militaryEmail: string;
    militaryName: string;
    highlightRole: string | null;
    fabom: string | null;
    photoMimeType: string | null;
    photoBase64: string | null;
    impact: HighlightImpact;
    locality: { id: string; code: string; name: string };
    highlightText: string;
    createdBy: { id: string; name: string } | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: item.id,
      ldapUid: item.ldapUid,
      militaryEmail: item.militaryEmail,
      militaryName: item.militaryName,
      highlightRole: item.highlightRole,
      fabom: item.fabom,
      photoMimeType: item.photoMimeType,
      photoBase64: item.photoBase64,
      impact: item.impact,
      locality: item.locality,
      text: item.highlightText,
      createdBy: item.createdBy,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private async assertHighlightLocalityExists(localityId: string) {
    const locality = await this.prisma.locality.findUnique({
      where: { id: localityId },
      select: { id: true },
    });
    if (!locality) {
      throwError('VALIDATION_ERROR', {
        field: 'localityId',
        reason: 'not_found',
      });
    }
  }

  private normalizeHighlightEmail(value: string, field: string) {
    const normalized = sanitizeText(value ?? '').toLowerCase();
    if (!normalized) {
      throwError('VALIDATION_ERROR', { field, reason: 'required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throwError('VALIDATION_ERROR', { field, reason: 'invalid_email' });
    }
    return normalized;
  }

  private normalizeHighlightImpact(
    value: string,
    field: string,
  ): HighlightImpact {
    const normalized = sanitizeText(value ?? '').toUpperCase();
    if (normalized === 'MULTIPLICADOR' || normalized === 'SIMBOLICO') {
      return normalized;
    }
    throwError('VALIDATION_ERROR', { field, reason: 'invalid_impact' });
  }

  private normalizeHighlightPhotoMimeType(
    value: string | null | undefined,
    field: string,
  ) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const normalized = sanitizeText(value ?? '').toLowerCase();
    if (!normalized) return null;
    if (!/^image\/[a-z0-9.+-]+$/i.test(normalized)) {
      throwError('VALIDATION_ERROR', { field, reason: 'invalid_mime_type' });
    }
    return normalized;
  }

  private normalizeHighlightPhotoBase64(
    value: string | null | undefined,
    field: string,
  ) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const normalized = String(value ?? '')
      .replace(/\s+/g, '')
      .trim();
    if (!normalized) return null;
    if (normalized.length > 4_000_000) {
      throwError('VALIDATION_ERROR', { field, reason: 'payload_too_large' });
    }
    if (!/^[A-Za-z0-9+/=_-]+$/.test(normalized)) {
      throwError('VALIDATION_ERROR', { field, reason: 'invalid_base64' });
    }
    return normalized;
  }

  private normalizeHighlightText(value: string, field: string) {
    const normalized = String(value ?? '')
      .replace(/[<>]/g, '')
      .trim();
    if (!normalized) {
      throwError('VALIDATION_ERROR', { field, reason: 'required' });
    }
    return normalized;
  }

  private normalizeRequiredText(
    value: string | null | undefined,
    field: string,
  ) {
    const normalized = sanitizeText(value ?? '');
    if (!normalized) {
      throwError('VALIDATION_ERROR', { field, reason: 'required' });
    }
    return normalized;
  }

  private normalizeOptionalText(value: string | null | undefined) {
    if (value === null) return null;
    if (value === undefined) return undefined;
    const normalized = sanitizeText(value);
    return normalized || null;
  }

  private normalizeTags(values: string[] | null | undefined) {
    if (values === undefined || values === null) return undefined;
    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const value of values) {
      const clean = sanitizeText(value ?? '').toLowerCase();
      if (!clean || seen.has(clean)) continue;
      seen.add(clean);
      normalized.push(clean);
      if (normalized.length >= 30) break;
    }
    return normalized;
  }

  private normalizeUrl(value: string | null | undefined, field: string) {
    const normalized = sanitizeText(value ?? '');
    if (!normalized) {
      throwError('VALIDATION_ERROR', { field, reason: 'required' });
    }

    let url: URL;
    try {
      url = new URL(normalized);
    } catch {
      throwError('VALIDATION_ERROR', { field, reason: 'invalid_url' });
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
      throwError('VALIDATION_ERROR', { field, reason: 'invalid_protocol' });
    }

    return url.toString();
  }

  private resolveCoverUrl(
    value: string | null | undefined,
    sourceUrl: string,
  ): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const normalized = sanitizeText(value);
    if (!normalized) return null;

    if (normalized.startsWith('/social-communication/uploads/')) {
      return normalized;
    }

    try {
      const resolved = new URL(normalized, sourceUrl);
      if (!['http:', 'https:'].includes(resolved.protocol)) {
        return null;
      }
      return resolved.toString();
    } catch {
      return null;
    }
  }

  private parseOptionalDate(
    value: string | null | undefined,
    field: string,
  ): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const normalized = sanitizeText(value);
    if (!normalized) return null;
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      throwError('VALIDATION_ERROR', { field, reason: 'invalid_date' });
    }
    return parsed;
  }

  private buildFallbackTitle(sourceUrl: string) {
    try {
      const host = new URL(sourceUrl).hostname.replace(/^www\./i, '');
      return host || 'Materia';
    } catch {
      return 'Materia';
    }
  }

  private async extractMetadataSafe(
    sourceUrl: string,
  ): Promise<MetadataExtraction> {
    try {
      return await this.extractMetadata(sourceUrl);
    } catch {
      return {};
    }
  }

  private async extractMetadata(
    sourceUrl: string,
  ): Promise<MetadataExtraction> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);

    try {
      const response = await fetch(sourceUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari',
          accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) return {};
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.toLowerCase().includes('text/html')) return {};

      const html = await response.text();
      const metaMap = this.extractMetaMap(html);

      const title = this.firstNonEmpty(
        metaMap.get('og:title'),
        metaMap.get('twitter:title'),
        this.extractTitleTag(html),
      );

      const coverImageUrl = this.firstNonEmpty(
        metaMap.get('og:image:secure_url'),
        metaMap.get('og:image:url'),
        metaMap.get('og:image'),
        metaMap.get('twitter:image'),
      );

      const summary = this.firstNonEmpty(
        metaMap.get('og:description'),
        metaMap.get('description'),
        metaMap.get('twitter:description'),
      );

      const publishedAt = this.firstNonEmpty(
        metaMap.get('article:published_time'),
        metaMap.get('published_time'),
        metaMap.get('pubdate'),
        metaMap.get('date'),
      );

      return { title, coverImageUrl, summary, publishedAt };
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractMetaMap(html: string) {
    const metaMap = new Map<string, string>();
    const tags = html.match(/<meta\s+[^>]*>/gi) ?? [];

    for (const tag of tags) {
      const attrs = this.parseTagAttributes(tag);
      const keyRaw = attrs.property ?? attrs.name;
      const contentRaw = attrs.content;
      if (!keyRaw || !contentRaw) continue;
      const key = keyRaw.trim().toLowerCase();
      const content = this.decodeHtmlEntities(contentRaw.trim());
      if (!key || !content) continue;
      if (!metaMap.has(key)) metaMap.set(key, content);
    }

    return metaMap;
  }

  private parseTagAttributes(tag: string) {
    const attrs: Record<string, string> = {};
    const attrRegex =
      /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
    let match: RegExpExecArray | null;
    while ((match = attrRegex.exec(tag)) !== null) {
      const name = (match[1] ?? '').trim().toLowerCase();
      if (!name) continue;
      const value = match[2] ?? match[3] ?? match[4] ?? '';
      attrs[name] = value;
    }
    return attrs;
  }

  private extractTitleTag(html: string) {
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!match?.[1]) return undefined;
    const value = match[1].replace(/\s+/g, ' ').trim();
    return this.decodeHtmlEntities(value) || undefined;
  }

  private firstNonEmpty(...values: Array<string | null | undefined>) {
    for (const value of values) {
      if (!value) continue;
      const normalized = sanitizeText(value);
      if (normalized) return normalized;
    }
    return undefined;
  }

  private decodeHtmlEntities(value: string) {
    return value
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>');
  }
}
