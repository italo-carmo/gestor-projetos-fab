import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

type MetadataExtraction = {
  title?: string;
  coverImageUrl?: string;
  summary?: string;
  publishedAt?: string;
};

@Injectable()
export class SocialCommunicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(filters: { q?: string }) {
    const where: Prisma.SocialCommunicationArticleWhereInput = {};
    if (filters.q) {
      where.OR = [
        { title: { contains: filters.q, mode: 'insensitive' } },
        { summary: { contains: filters.q, mode: 'insensitive' } },
        { sourceUrl: { contains: filters.q, mode: 'insensitive' } },
      ];
    }

    const items = await this.prisma.socialCommunicationArticle.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return { items };
  }

  async create(
    payload: {
      url: string;
      title?: string;
      coverImageUrl?: string | null;
      summary?: string | null;
      publishedAt?: string | null;
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
        coverImageUrl: this.resolveCoverUrl(payload.coverImageUrl ?? metadata.coverImageUrl ?? null, sourceUrl),
        summary: this.normalizeOptionalText(payload.summary ?? metadata.summary ?? null),
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

  async update(
    id: string,
    payload: {
      url?: string;
      title?: string;
      coverImageUrl?: string | null;
      summary?: string | null;
      publishedAt?: string | null;
    },
    user?: RbacUser,
  ) {
    this.assertEditorAccess(user);

    const existing = await this.prisma.socialCommunicationArticle.findUnique({ where: { id } });
    if (!existing) throwError('NOT_FOUND');

    const sourceUrl = payload.url
      ? this.normalizeUrl(payload.url, 'url')
      : existing.sourceUrl;
    const sourceUrlChanged = sourceUrl !== existing.sourceUrl;
    const metadata: MetadataExtraction = sourceUrlChanged ? await this.extractMetadataSafe(sourceUrl) : {};

    const title = payload.title !== undefined
      ? this.normalizeRequiredText(payload.title, 'title')
      : sourceUrlChanged
        ? this.normalizeRequiredText(
          metadata.title ?? existing.title ?? this.buildFallbackTitle(sourceUrl),
          'title',
        )
        : undefined;

    let coverImageUrl: string | null | undefined;
    if (payload.coverImageUrl !== undefined) {
      coverImageUrl = this.resolveCoverUrl(payload.coverImageUrl, sourceUrl);
    } else if (sourceUrlChanged) {
      coverImageUrl =
        this.resolveCoverUrl(metadata.coverImageUrl ?? null, sourceUrl) ?? existing.coverImageUrl ?? null;
    }

    const summary = payload.summary !== undefined
      ? this.normalizeOptionalText(payload.summary)
      : sourceUrlChanged
        ? this.normalizeOptionalText(metadata.summary ?? existing.summary ?? null)
        : undefined;

    const publishedAt = payload.publishedAt !== undefined
      ? this.parseOptionalDate(payload.publishedAt, 'publishedAt')
      : sourceUrlChanged
        ? this.parseOptionalDate(metadata.publishedAt ?? null, 'publishedAt') ?? existing.publishedAt ?? null
        : undefined;

    const updated = await this.prisma.socialCommunicationArticle.update({
      where: { id },
      data: {
        sourceUrl,
        title,
        coverImageUrl,
        summary,
        publishedAt,
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

    const existing = await this.prisma.socialCommunicationArticle.findUnique({ where: { id } });
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
      coverImageUrl: this.resolveCoverUrl(metadata.coverImageUrl ?? null, sourceUrl),
      summary: this.normalizeOptionalText(metadata.summary ?? null),
      publishedAt: this.parseOptionalDate(metadata.publishedAt ?? null, 'publishedAt')?.toISOString() ?? null,
    };
  }

  private assertEditorAccess(user?: RbacUser) {
    if (!hasAnyRole(user, [ROLE_COORDENACAO_CIPAVD, ROLE_COMANDANTE_COMGEP, ROLE_TI])) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private normalizeRequiredText(value: string | null | undefined, field: string) {
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

  private parseOptionalDate(value: string | null | undefined, field: string): Date | null | undefined {
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

  private async extractMetadataSafe(sourceUrl: string): Promise<MetadataExtraction> {
    try {
      return await this.extractMetadata(sourceUrl);
    } catch {
      return {};
    }
  }

  private async extractMetadata(sourceUrl: string): Promise<MetadataExtraction> {
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
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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
    const attrRegex = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
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
