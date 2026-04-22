import { Injectable, Logger } from '@nestjs/common';
import {
  KnowledgeBaseDocumentStatus,
  KnowledgeBaseTheme,
  Prisma,
} from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import * as path from 'node:path';
import * as XLSX from 'xlsx';
import { AuditService } from '../audit/audit.service';
import { throwError } from '../common/http-error';
import { LitellmService } from '../llm/litellm.service';
import { PrismaService } from '../prisma/prisma.service';
import type { RbacUser } from '../rbac/rbac.types';
import { SettingsService } from '../settings/settings.service';
import { resolveExistingKnowledgeBaseDocumentPath } from './knowledge-base-storage';

export type KnowledgeBaseRagHit = {
  chunkId: string;
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  knowledgeBaseTheme: KnowledgeBaseTheme;
  documentId: string;
  documentTitle: string;
  fileName: string;
  chunkIndex: number;
  textContent: string;
  semanticScore: number;
  lexicalScore: number;
  fusedScore: number;
};

type ChunkDraft = {
  chunkIndex: number;
  textContent: string;
  tokenCount: number;
  metadataJson: Record<string, unknown>;
};

type PdfParseResult = {
  text?: string;
  numpages?: number | null;
  total?: number | null;
};

type PdfParseFn = (input: Buffer) => Promise<PdfParseResult>;

@Injectable()
export class KnowledgeBasesService {
  private readonly logger = new Logger(KnowledgeBasesService.name);
  private readonly chunkTargetChars = 1_600;
  private readonly chunkOverlapChars = 260;
  private readonly ragCandidateMultiplier = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly litellm: LitellmService,
    private readonly settings: SettingsService,
  ) {}

  async listKnowledgeBases() {
    const [items, groupedStatuses] = await Promise.all([
      this.prisma.knowledgeBase.findMany({
        orderBy: [
          { isActive: 'desc' },
          { sortOrder: 'asc' },
          { name: 'asc' },
        ],
        include: {
          _count: {
            select: { documents: true, chunks: true },
          },
        },
      }),
      this.prisma.knowledgeBaseDocument.groupBy({
        by: ['knowledgeBaseId', 'status'],
        _count: { _all: true },
      }),
    ]);

    const statusMap = new Map<
      string,
      Partial<Record<KnowledgeBaseDocumentStatus, number>>
    >();
    for (const row of groupedStatuses) {
      const current = statusMap.get(row.knowledgeBaseId) ?? {};
      current[row.status] = row._count._all;
      statusMap.set(row.knowledgeBaseId, current);
    }

    return {
      items: items.map((item) => ({
        ...item,
        documentStatusSummary: {
          pending:
            statusMap.get(item.id)?.[KnowledgeBaseDocumentStatus.PENDING] ?? 0,
          indexing:
            statusMap.get(item.id)?.[KnowledgeBaseDocumentStatus.INDEXING] ?? 0,
          ready:
            statusMap.get(item.id)?.[KnowledgeBaseDocumentStatus.READY] ?? 0,
          failed:
            statusMap.get(item.id)?.[KnowledgeBaseDocumentStatus.FAILED] ?? 0,
        },
      })),
    };
  }

  async listSelectableKnowledgeBases() {
    const items = await this.prisma.knowledgeBase.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        theme: true,
      },
    });
    return { items };
  }

  async createKnowledgeBase(
    payload: {
      key?: string;
      name?: string;
      description?: string | null;
      theme?: KnowledgeBaseTheme | string | null;
      isActive?: boolean;
      sortOrder?: number | null;
    },
    user?: RbacUser,
  ) {
    const name = String(payload.name ?? '').trim();
    if (!name) {
      throwError('VALIDATION_ERROR', { field: 'name', reason: 'required' });
    }
    const key = this.normalizeKnowledgeBaseKey(payload.key || name);
    if (!key) {
      throwError('VALIDATION_ERROR', { field: 'key', reason: 'required' });
    }

    const created = await this.prisma.knowledgeBase.create({
      data: {
        key,
        name,
        description: this.nullishTrim(payload.description),
        theme: this.parseTheme(payload.theme),
        isActive: payload.isActive ?? true,
        sortOrder: this.parseSortOrder(payload.sortOrder),
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'admin_rbac',
      action: 'create_ai_knowledge_base',
      entityId: created.id,
      diffJson: created,
    });

    return created;
  }

  async updateKnowledgeBase(
    id: string,
    payload: {
      key?: string;
      name?: string;
      description?: string | null;
      theme?: KnowledgeBaseTheme | string | null;
      isActive?: boolean;
      sortOrder?: number | null;
    },
    user?: RbacUser,
  ) {
    const current = await this.prisma.knowledgeBase.findUnique({ where: { id } });
    if (!current) throwError('NOT_FOUND');

    const updated = await this.prisma.knowledgeBase.update({
      where: { id },
      data: {
        key:
          payload.key === undefined
            ? undefined
            : this.normalizeKnowledgeBaseKey(payload.key || current.name),
        name: payload.name === undefined ? undefined : String(payload.name).trim(),
        description:
          payload.description === undefined
            ? undefined
            : this.nullishTrim(payload.description),
        theme:
          payload.theme === undefined ? undefined : this.parseTheme(payload.theme),
        isActive: payload.isActive ?? undefined,
        sortOrder:
          payload.sortOrder === undefined
            ? undefined
            : this.parseSortOrder(payload.sortOrder),
      },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'admin_rbac',
      action: 'update_ai_knowledge_base',
      entityId: updated.id,
      diffJson: updated,
    });

    return updated;
  }

  async deleteKnowledgeBase(id: string, user?: RbacUser) {
    const knowledgeBase = await this.prisma.knowledgeBase.findUnique({
      where: { id },
      include: {
        documents: {
          select: { id: true, storageKey: true, fileUrl: true },
        },
      },
    });
    if (!knowledgeBase) throwError('NOT_FOUND');

    await this.prisma.knowledgeBase.delete({ where: { id } });
    for (const document of knowledgeBase.documents) {
      const storageKey =
        this.nullishTrim(document.storageKey) ||
        path.basename(String(document.fileUrl ?? '').trim());
      const filePath = resolveExistingKnowledgeBaseDocumentPath(storageKey ?? '');
      if (filePath) {
        await rm(filePath, { force: true }).catch(() => undefined);
      }
    }

    await this.audit.log({
      userId: user?.id,
      resource: 'admin_rbac',
      action: 'delete_ai_knowledge_base',
      entityId: id,
      diffJson: { deletedDocuments: knowledgeBase.documents.length },
    });

    return { ok: true };
  }

  async listKnowledgeBaseDocuments(knowledgeBaseId: string) {
    await this.getKnowledgeBaseOrThrow(knowledgeBaseId);
    const items = await this.prisma.knowledgeBaseDocument.findMany({
      where: { knowledgeBaseId },
      orderBy: [{ createdAt: 'desc' }, { title: 'asc' }],
      include: {
        _count: { select: { chunks: true } },
      },
    });
    return {
      items: items.map((item) => ({
        ...item,
        downloadUrl: `/admin/knowledge-bases/documents/${encodeURIComponent(item.id)}/download`,
      })),
    };
  }

  async uploadDocument(
    knowledgeBaseId: string,
    file: Express.Multer.File,
    body: { title?: string | null },
    user?: RbacUser,
  ) {
    const knowledgeBase = await this.getKnowledgeBaseOrThrow(knowledgeBaseId);
    if (!file) {
      throwError('VALIDATION_ERROR', { field: 'file', reason: 'required' });
    }

    const checksum = await this.computeFileChecksum(file.path);
    const document = await this.prisma.knowledgeBaseDocument.create({
      data: {
        knowledgeBaseId: knowledgeBase.id,
        title:
          this.nullishTrim(body.title) ||
          this.stripFileExtension(file.originalname) ||
          'Documento da base',
        fileName: file.originalname,
        fileUrl: `/admin/knowledge-bases/documents/${encodeURIComponent(randomUUID())}/download`,
        storageKey: file.filename,
        mimeType: file.mimetype || this.detectMimeType(file.originalname),
        fileSize: file.size ?? null,
        checksum,
        status: KnowledgeBaseDocumentStatus.PENDING,
      },
    });

    const updatedFileUrl = `/admin/knowledge-bases/documents/${encodeURIComponent(document.id)}/download`;
    await this.prisma.knowledgeBaseDocument.update({
      where: { id: document.id },
      data: { fileUrl: updatedFileUrl },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'admin_rbac',
      action: 'upload_ai_knowledge_document',
      entityId: document.id,
      diffJson: {
        knowledgeBaseId,
        title: document.title,
        fileName: document.fileName,
        checksum,
      },
    });

    await this.reindexDocument(document.id, user);
    return this.getKnowledgeBaseDocumentById(document.id);
  }

  async updateDocument(
    id: string,
    payload: { title?: string | null },
    user?: RbacUser,
  ) {
    const current = await this.prisma.knowledgeBaseDocument.findUnique({
      where: { id },
    });
    if (!current) throwError('NOT_FOUND');

    const updated = await this.prisma.knowledgeBaseDocument.update({
      where: { id },
      data: {
        title:
          payload.title === undefined
            ? undefined
            : this.nullishTrim(payload.title) || current.title,
      },
      include: { _count: { select: { chunks: true } } },
    });

    await this.audit.log({
      userId: user?.id,
      resource: 'admin_rbac',
      action: 'update_ai_knowledge_document',
      entityId: updated.id,
      diffJson: { title: updated.title },
    });

    return updated;
  }

  async deleteDocument(id: string, user?: RbacUser) {
    const current = await this.prisma.knowledgeBaseDocument.findUnique({
      where: { id },
    });
    if (!current) throwError('NOT_FOUND');

    await this.prisma.knowledgeBaseDocument.delete({ where: { id } });
    const storageKey =
      this.nullishTrim(current.storageKey) ||
      path.basename(String(current.fileUrl ?? '').trim());
    const filePath = resolveExistingKnowledgeBaseDocumentPath(storageKey ?? '');
    if (filePath) {
      await rm(filePath, { force: true }).catch(() => undefined);
    }

    await this.audit.log({
      userId: user?.id,
      resource: 'admin_rbac',
      action: 'delete_ai_knowledge_document',
      entityId: id,
      diffJson: { knowledgeBaseId: current.knowledgeBaseId },
    });

    return { ok: true };
  }

  async getKnowledgeBaseDocumentById(id: string) {
    const item = await this.prisma.knowledgeBaseDocument.findUnique({
      where: { id },
      include: {
        knowledgeBase: {
          select: { id: true, key: true, name: true, theme: true },
        },
        _count: { select: { chunks: true } },
      },
    });
    if (!item) throwError('NOT_FOUND');
    return {
      ...item,
      downloadUrl: `/admin/knowledge-bases/documents/${encodeURIComponent(item.id)}/download`,
    };
  }

  async reindexKnowledgeBase(id: string, user?: RbacUser) {
    const knowledgeBase = await this.getKnowledgeBaseOrThrow(id);
    const documents = await this.prisma.knowledgeBaseDocument.findMany({
      where: { knowledgeBaseId: id },
      select: { id: true },
      orderBy: [{ createdAt: 'asc' }],
    });
    for (const document of documents) {
      await this.reindexDocument(document.id, user);
    }
    return {
      ok: true,
      knowledgeBaseId: knowledgeBase.id,
      reindexedDocuments: documents.length,
    };
  }

  async reindexDocument(id: string, user?: RbacUser) {
    const document = await this.prisma.knowledgeBaseDocument.findUnique({
      where: { id },
      include: {
        knowledgeBase: {
          select: { id: true, name: true, key: true, theme: true, isActive: true },
        },
      },
    });
    if (!document) throwError('NOT_FOUND');

    const storageKey =
      this.nullishTrim(document.storageKey) ||
      path.basename(String(document.fileUrl ?? '').trim());
    const filePath = resolveExistingKnowledgeBaseDocumentPath(storageKey ?? '');
    if (!filePath) {
      throwError('NOT_FOUND');
    }

    await this.prisma.knowledgeBaseDocument.update({
      where: { id },
      data: {
        status: KnowledgeBaseDocumentStatus.INDEXING,
        indexError: null,
      },
    });

    try {
      const extraction = await this.extractTextFromFile({
        filePath,
        fileName: document.fileName,
        mimeType: document.mimeType,
      });
      const chunks = this.chunkText(extraction.textContent, {
        knowledgeBaseName: document.knowledgeBase.name,
        documentTitle: document.title,
      });

      let embeddings: number[][] = [];
      const embeddingModel = await this.settings.getEmbeddingModel();
      if (embeddingModel && chunks.length > 0) {
        embeddings = await this.embedChunks(
          chunks.map((chunk) => chunk.textContent),
          embeddingModel,
        );
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.knowledgeBaseChunk.deleteMany({ where: { documentId: id } });
        for (let index = 0; index < chunks.length; index += 1) {
          const chunk = chunks[index];
          await this.insertChunkRow(tx, {
            id: this.buildDeterministicChunkId(id, chunk.chunkIndex),
            knowledgeBaseId: document.knowledgeBaseId,
            documentId: id,
            chunkIndex: chunk.chunkIndex,
            textContent: chunk.textContent,
            tokenCount: chunk.tokenCount,
            metadataJson: chunk.metadataJson,
            embedding: embeddings[index] ?? null,
          });
        }

        await tx.knowledgeBaseDocument.update({
          where: { id },
          data: {
            status: KnowledgeBaseDocumentStatus.READY,
            contentText: extraction.textContent,
            parsedAt: new Date(),
            lastIndexedAt: new Date(),
            chunkCount: chunks.length,
            indexError: null,
            metadataJson: {
              ...extraction.metadataJson,
              embeddingModel: embeddingModel || null,
              extractedAt: new Date().toISOString(),
            },
          },
        });
      });

      await this.audit.log({
        userId: user?.id,
        resource: 'admin_rbac',
        action: 'reindex_ai_knowledge_document',
        entityId: id,
        diffJson: {
          chunkCount: chunks.length,
          embeddingModel: embeddingModel || null,
        },
      });

      return this.getKnowledgeBaseDocumentById(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Falha ao indexar documento da base ${document.knowledgeBase.key}/${id}: ${message}`,
      );
      await this.prisma.knowledgeBaseDocument.update({
        where: { id },
        data: {
          status: KnowledgeBaseDocumentStatus.FAILED,
          indexError: message.slice(0, 2000),
        },
      });
      throw error;
    }
  }

  async retrieveRelevantChunks(args: {
    query: string;
    knowledgeBaseIds?: string[];
    limit?: number;
  }): Promise<KnowledgeBaseRagHit[]> {
    const query = String(args.query ?? '').trim();
    const limit = Math.min(Math.max(Number(args.limit ?? 6), 1), 12);
    const knowledgeBaseIds = Array.from(
      new Set((args.knowledgeBaseIds ?? []).map((item) => String(item ?? '').trim()).filter(Boolean)),
    );
    if (!query || knowledgeBaseIds.length === 0) {
      return [];
    }

    const activeKnowledgeBases = await this.prisma.knowledgeBase.findMany({
      where: {
        id: { in: knowledgeBaseIds },
        isActive: true,
      },
      select: { id: true },
    });
    const activeIds = activeKnowledgeBases.map((item) => item.id);
    if (!activeIds.length) return [];

    const lexicalRows = await this.searchLexical(activeIds, query, limit * this.ragCandidateMultiplier);
    let semanticRows: Array<KnowledgeBaseRagHit & { rank: number }> = [];
    const embeddingModel = await this.settings.getEmbeddingModel();

    if (embeddingModel) {
      try {
        const result = await this.litellm.createEmbeddings({
          model: embeddingModel,
          input: query,
        });
        const queryEmbedding = result.embeddings[0];
        if (queryEmbedding?.length) {
          semanticRows = await this.searchSemantic(
            activeIds,
            queryEmbedding,
            limit * this.ragCandidateMultiplier,
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Falha na busca semântica da base de conhecimento; seguindo com busca lexical. Motivo: ${message}`,
        );
      }
    }

    const byChunkId = new Map<string, KnowledgeBaseRagHit>();
    const applyRankFusion = (
      rows: Array<KnowledgeBaseRagHit & { rank: number }>,
      kind: 'semantic' | 'lexical',
    ) => {
      for (const row of rows) {
        const current =
          byChunkId.get(row.chunkId) ??
          ({
            ...row,
            semanticScore: 0,
            lexicalScore: 0,
            fusedScore: 0,
          } satisfies KnowledgeBaseRagHit);
        if (kind === 'semantic') {
          current.semanticScore = Math.max(current.semanticScore, row.semanticScore);
        } else {
          current.lexicalScore = Math.max(current.lexicalScore, row.lexicalScore);
        }
        current.fusedScore += 1 / (50 + row.rank);
        byChunkId.set(row.chunkId, current);
      }
    };

    applyRankFusion(semanticRows, 'semantic');
    applyRankFusion(lexicalRows, 'lexical');

    return Array.from(byChunkId.values())
      .sort((a, b) => {
        if (b.fusedScore !== a.fusedScore) return b.fusedScore - a.fusedScore;
        if (b.semanticScore !== a.semanticScore) {
          return b.semanticScore - a.semanticScore;
        }
        return b.lexicalScore - a.lexicalScore;
      })
      .slice(0, limit);
  }

  buildPromptContext(hits: KnowledgeBaseRagHit[]) {
    if (!hits.length) {
      return {
        text: '',
        references: [],
      };
    }
    const references = hits.map((hit, index) => ({
      id: `KB${index + 1}`,
      label: `${hit.knowledgeBaseName} • ${hit.documentTitle}`,
      description: `Base ${hit.knowledgeBaseTheme} • trecho ${hit.chunkIndex + 1}`,
      href: `/admin?tab=knowledge-bases&baseId=${encodeURIComponent(hit.knowledgeBaseId)}&docId=${encodeURIComponent(hit.documentId)}`,
    }));

    const lines = hits.map((hit, index) => {
      const citation = `KB${index + 1}`;
      return [
        `[${citation}] Base: ${hit.knowledgeBaseName} (${hit.knowledgeBaseTheme})`,
        `Documento: ${hit.documentTitle}`,
        `Arquivo: ${hit.fileName}`,
        `Trecho recuperado: ${hit.textContent}`,
      ].join('\n');
    });

    return {
      text: lines.join('\n\n'),
      references,
    };
  }

  private async searchSemantic(
    knowledgeBaseIds: string[],
    queryEmbedding: number[],
    limit: number,
  ): Promise<Array<KnowledgeBaseRagHit & { rank: number }>> {
    const vectorLiteral = this.toVectorLiteral(queryEmbedding);
    const rows = await this.prisma.$queryRaw<
      Array<{
        chunkId: string;
        knowledgeBaseId: string;
        knowledgeBaseName: string;
        knowledgeBaseTheme: KnowledgeBaseTheme;
        documentId: string;
        documentTitle: string;
        fileName: string;
        chunkIndex: number;
        textContent: string;
        semanticScore: number;
      }>
    >(Prisma.sql`
      SELECT
        kc."id" AS "chunkId",
        kb."id" AS "knowledgeBaseId",
        kb."name" AS "knowledgeBaseName",
        kb."theme" AS "knowledgeBaseTheme",
        kd."id" AS "documentId",
        kd."title" AS "documentTitle",
        kd."fileName" AS "fileName",
        kc."chunkIndex" AS "chunkIndex",
        kc."textContent" AS "textContent",
        GREATEST(0, 1 - (kc."embedding" <=> ${vectorLiteral}::vector)) AS "semanticScore"
      FROM "KnowledgeBaseChunk" kc
      INNER JOIN "KnowledgeBaseDocument" kd ON kd."id" = kc."documentId"
      INNER JOIN "KnowledgeBase" kb ON kb."id" = kc."knowledgeBaseId"
      WHERE
        kb."isActive" = true
        AND kd."status" = 'READY'
        AND kc."embedding" IS NOT NULL
        AND kc."knowledgeBaseId" IN (${Prisma.join(knowledgeBaseIds)})
      ORDER BY kc."embedding" <=> ${vectorLiteral}::vector ASC
      LIMIT ${limit}
    `);

    return rows.map((row, index) => ({
      ...row,
      lexicalScore: 0,
      fusedScore: 0,
      rank: index + 1,
    }));
  }

  private async searchLexical(
    knowledgeBaseIds: string[],
    query: string,
    limit: number,
  ): Promise<Array<KnowledgeBaseRagHit & { rank: number }>> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        chunkId: string;
        knowledgeBaseId: string;
        knowledgeBaseName: string;
        knowledgeBaseTheme: KnowledgeBaseTheme;
        documentId: string;
        documentTitle: string;
        fileName: string;
        chunkIndex: number;
        textContent: string;
        lexicalScore: number;
      }>
    >(Prisma.sql`
      SELECT
        kc."id" AS "chunkId",
        kb."id" AS "knowledgeBaseId",
        kb."name" AS "knowledgeBaseName",
        kb."theme" AS "knowledgeBaseTheme",
        kd."id" AS "documentId",
        kd."title" AS "documentTitle",
        kd."fileName" AS "fileName",
        kc."chunkIndex" AS "chunkIndex",
        kc."textContent" AS "textContent",
        ts_rank_cd(
          to_tsvector('portuguese', COALESCE(kc."textContent", '')),
          plainto_tsquery('portuguese', ${query})
        ) AS "lexicalScore"
      FROM "KnowledgeBaseChunk" kc
      INNER JOIN "KnowledgeBaseDocument" kd ON kd."id" = kc."documentId"
      INNER JOIN "KnowledgeBase" kb ON kb."id" = kc."knowledgeBaseId"
      WHERE
        kb."isActive" = true
        AND kd."status" = 'READY'
        AND kc."knowledgeBaseId" IN (${Prisma.join(knowledgeBaseIds)})
        AND to_tsvector('portuguese', COALESCE(kc."textContent", ''))
          @@ plainto_tsquery('portuguese', ${query})
      ORDER BY "lexicalScore" DESC, kc."createdAt" ASC
      LIMIT ${limit}
    `);

    return rows.map((row, index) => ({
      ...row,
      semanticScore: 0,
      fusedScore: 0,
      rank: index + 1,
    }));
  }

  private async insertChunkRow(
    tx: Prisma.TransactionClient,
    row: {
      id: string;
      knowledgeBaseId: string;
      documentId: string;
      chunkIndex: number;
      textContent: string;
      tokenCount: number;
      metadataJson: Record<string, unknown>;
      embedding: number[] | null;
    },
  ) {
    const embeddingSql = row.embedding
      ? Prisma.sql`${this.toVectorLiteral(row.embedding)}::vector`
      : Prisma.sql`NULL`;
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "KnowledgeBaseChunk" (
        "id",
        "knowledgeBaseId",
        "documentId",
        "chunkIndex",
        "textContent",
        "tokenCount",
        "metadataJson",
        "embedding",
        "createdAt"
      )
      VALUES (
        ${row.id},
        ${row.knowledgeBaseId},
        ${row.documentId},
        ${row.chunkIndex},
        ${row.textContent},
        ${row.tokenCount},
        ${JSON.stringify(row.metadataJson)}::jsonb,
        ${embeddingSql},
        ${new Date()}
      )
    `);
  }

  private async embedChunks(chunks: string[], embeddingModel: string) {
    const results: number[][] = [];
    const batchSize = 24;
    for (let index = 0; index < chunks.length; index += batchSize) {
      const slice = chunks.slice(index, index + batchSize);
      const response = await this.litellm.createEmbeddings({
        model: embeddingModel,
        input: slice,
      });
      results.push(...response.embeddings);
    }
    return results;
  }

  private chunkText(
    text: string,
    metadata: { knowledgeBaseName: string; documentTitle: string },
  ): ChunkDraft[] {
    const source = this.normalizeExtractedText(text);
    if (!source) return [];

    const paragraphs = source
      .split(/\n{2,}/)
      .map((item) => item.trim())
      .filter(Boolean);

    const chunks: ChunkDraft[] = [];
    let current = '';
    let chunkIndex = 0;

    const pushChunk = (value: string) => {
      const clean = value.trim();
      if (!clean) return;
      chunks.push({
        chunkIndex,
        textContent: clean,
        tokenCount: this.estimateTokenCount(clean),
        metadataJson: {
          source: metadata.knowledgeBaseName,
          documentTitle: metadata.documentTitle,
          chars: clean.length,
        },
      });
      chunkIndex += 1;
    };

    for (const paragraph of paragraphs) {
      if (!current) {
        current = paragraph;
        continue;
      }
      const candidate = `${current}\n\n${paragraph}`;
      if (candidate.length <= this.chunkTargetChars) {
        current = candidate;
        continue;
      }

      if (current.length > this.chunkTargetChars) {
        for (const piece of this.breakLongText(current)) {
          pushChunk(piece);
        }
        current = paragraph;
        continue;
      }

      pushChunk(current);
      const overlap = current.slice(-this.chunkOverlapChars).trim();
      current = overlap ? `${overlap}\n\n${paragraph}` : paragraph;
      if (current.length <= this.chunkTargetChars) continue;
      for (const piece of this.breakLongText(current)) {
        pushChunk(piece);
      }
      current = '';
    }

    if (current) {
      if (current.length <= this.chunkTargetChars) {
        pushChunk(current);
      } else {
        for (const piece of this.breakLongText(current)) {
          pushChunk(piece);
        }
      }
    }

    return chunks;
  }

  private breakLongText(text: string) {
    const source = text.trim();
    if (!source) return [];
    const sentences = source
      .split(/(?<=[.!?;:])\s+/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (sentences.length <= 1) {
      return this.breakByLength(source);
    }

    const parts: string[] = [];
    let current = '';
    for (const sentence of sentences) {
      const candidate = current ? `${current} ${sentence}` : sentence;
      if (candidate.length <= this.chunkTargetChars) {
        current = candidate;
        continue;
      }
      if (current) parts.push(current);
      current = sentence;
      if (current.length > this.chunkTargetChars) {
        parts.push(...this.breakByLength(current));
        current = '';
      }
    }
    if (current) parts.push(current);
    return parts;
  }

  private breakByLength(text: string) {
    const pieces: string[] = [];
    let cursor = 0;
    while (cursor < text.length) {
      const next = text.slice(cursor, cursor + this.chunkTargetChars).trim();
      if (next) pieces.push(next);
      cursor += Math.max(1, this.chunkTargetChars - this.chunkOverlapChars);
    }
    return pieces;
  }

  private async extractTextFromFile(args: {
    filePath: string;
    fileName: string;
    mimeType?: string | null;
  }): Promise<{
    textContent: string;
    metadataJson: Record<string, unknown>;
  }> {
    const extension = path.extname(args.fileName || args.filePath).toLowerCase();
    const mimeType = String(args.mimeType ?? '').toLowerCase();

    if (['.txt', '.md', '.markdown', '.csv', '.log', '.xml'].includes(extension)) {
      const content = await readFile(args.filePath, 'utf-8');
      return {
        textContent: content,
        metadataJson: { extractionMethod: 'utf8_text', extension, mimeType },
      };
    }

    if (extension === '.json' || mimeType.includes('json')) {
      const content = await readFile(args.filePath, 'utf-8');
      try {
        return {
          textContent: JSON.stringify(JSON.parse(content), null, 2),
          metadataJson: { extractionMethod: 'json_pretty', extension, mimeType },
        };
      } catch {
        return {
          textContent: content,
          metadataJson: { extractionMethod: 'json_text_fallback', extension, mimeType },
        };
      }
    }

    if (
      extension === '.html' ||
      extension === '.htm' ||
      mimeType.includes('html')
    ) {
      const content = await readFile(args.filePath, 'utf-8');
      return {
        textContent: this.stripHtml(content),
        metadataJson: { extractionMethod: 'html_strip', extension, mimeType },
      };
    }

    if (extension === '.pdf' || mimeType.includes('pdf')) {
      const buffer = await readFile(args.filePath);
      const pdfParseModule = await import('pdf-parse');
      const pdfParse = this.resolvePdfParseModule(pdfParseModule);
      const parsed = await pdfParse(buffer);
      return {
        textContent: String(parsed?.text ?? ''),
        metadataJson: {
          extractionMethod: 'pdf_parse',
          extension,
          mimeType,
          pageCount: Number(parsed?.numpages ?? parsed?.total ?? 0) || null,
        },
      };
    }

    if (extension === '.docx') {
      const mammothModule = await import('mammoth');
      const mammoth = mammothModule.default ?? mammothModule;
      const parsed = await mammoth.extractRawText({ path: args.filePath });
      return {
        textContent: String(parsed?.value ?? ''),
        metadataJson: { extractionMethod: 'docx_mammoth', extension, mimeType },
      };
    }

    if (extension === '.xlsx' || extension === '.xls') {
      const workbook = XLSX.readFile(args.filePath, { cellText: true });
      const sheetTexts = workbook.SheetNames.map((sheetName) => {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
          header: 1,
          blankrows: false,
        }) as Array<Array<unknown>>;
        const rowText = rows
          .map((row) =>
            row
              .map((cell) => String(cell ?? '').trim())
              .filter(Boolean)
              .join(' | '),
          )
          .filter(Boolean)
          .join('\n');
        return `Planilha: ${sheetName}\n${rowText}`;
      });
      return {
        textContent: sheetTexts.join('\n\n'),
        metadataJson: {
          extractionMethod: 'xlsx_sheet_to_json',
          extension,
          mimeType,
          sheetCount: workbook.SheetNames.length,
        },
      };
    }

    const fallbackBuffer = await readFile(args.filePath);
    const fallbackText = fallbackBuffer.toString('utf-8');
    if (this.looksLikeText(fallbackText)) {
      return {
        textContent: fallbackText,
        metadataJson: { extractionMethod: 'utf8_fallback', extension, mimeType },
      };
    }

    throw new Error(
      `Formato de documento não suportado para extração de texto (${extension || mimeType || 'desconhecido'}).`,
    );
  }

  private resolvePdfParseModule(moduleValue: unknown): PdfParseFn {
    const candidates = this.collectPdfParseCandidates(moduleValue);
    for (const candidate of candidates) {
      if (
        typeof candidate === 'function' &&
        typeof (candidate as { prototype?: { getText?: unknown } }).prototype
          ?.getText !== 'function'
      ) {
        return candidate as PdfParseFn;
      }
    }

    const parserConstructor = candidates.find(
      (candidate) =>
        typeof candidate === 'function' &&
        typeof (candidate as { prototype?: { getText?: unknown } }).prototype
          ?.getText === 'function',
    ) as
      | (new (args: { data: Buffer }) => {
          getText: () => Promise<PdfParseResult>;
          destroy?: () => Promise<void> | void;
        })
      | undefined;

    if (parserConstructor) {
      return async (input: Buffer) => {
        const parser = new parserConstructor({ data: input });
        try {
          const parsed = await parser.getText();
          return parsed;
        } finally {
          await parser.destroy?.();
        }
      };
    }

    throw new Error('pdf-parse não exportou uma API de parsing compatível.');
  }

  private collectPdfParseCandidates(moduleValue: unknown): unknown[] {
    const candidates: unknown[] = [moduleValue];
    if (!moduleValue || typeof moduleValue !== 'object') {
      return candidates;
    }

    const moduleObject = moduleValue as Record<string, unknown>;
    candidates.push(moduleObject.default);
    candidates.push(moduleObject.PDFParse);

    if (moduleObject.default && typeof moduleObject.default === 'object') {
      const defaultObject = moduleObject.default as Record<string, unknown>;
      candidates.push(defaultObject.default);
      candidates.push(defaultObject.PDFParse);
    }

    return candidates;
  }

  private async computeFileChecksum(filePath: string) {
    const buffer = await readFile(filePath);
    return createHash('sha256').update(buffer).digest('hex');
  }

  private toVectorLiteral(values: number[]) {
    return `[${values.map((value) => Number(value).toFixed(12)).join(',')}]`;
  }

  private buildDeterministicChunkId(documentId: string, chunkIndex: number) {
    return createHash('sha1')
      .update(`${documentId}:${chunkIndex}`)
      .digest('hex')
      .slice(0, 24);
  }

  private estimateTokenCount(text: string) {
    return Math.max(1, Math.ceil(text.length / 4));
  }

  private stripFileExtension(fileName: string) {
    return String(fileName ?? '').replace(/\.[^.]+$/, '').trim();
  }

  private normalizeExtractedText(text: string) {
    return String(text ?? '')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\u0000/g, '')
      .trim();
  }

  private stripHtml(html: string) {
    return String(html ?? '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private looksLikeText(value: string) {
    const source = String(value ?? '');
    if (!source.trim()) return false;
    const suspicious = source.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g);
    return (suspicious?.length ?? 0) < Math.max(4, source.length * 0.01);
  }

  private detectMimeType(fileName: string) {
    const extension = path.extname(fileName ?? '').toLowerCase();
    switch (extension) {
      case '.pdf':
        return 'application/pdf';
      case '.docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case '.xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case '.xls':
        return 'application/vnd.ms-excel';
      case '.json':
        return 'application/json';
      case '.md':
      case '.markdown':
      case '.txt':
      case '.csv':
      case '.xml':
        return 'text/plain';
      case '.html':
      case '.htm':
        return 'text/html';
      default:
        return 'application/octet-stream';
    }
  }

  private parseTheme(value: KnowledgeBaseTheme | string | null | undefined) {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (!normalized) return KnowledgeBaseTheme.SHARED;
    if (
      normalized !== KnowledgeBaseTheme.CIPAVD &&
      normalized !== KnowledgeBaseTheme.SMIF &&
      normalized !== KnowledgeBaseTheme.CPCA &&
      normalized !== KnowledgeBaseTheme.SHARED
    ) {
      throwError('VALIDATION_ERROR', { field: 'theme', reason: 'invalid_enum' });
    }
    return normalized as KnowledgeBaseTheme;
  }

  private parseSortOrder(value: number | string | null | undefined) {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(-999, Math.min(999, Math.floor(parsed)));
  }

  private nullishTrim(value: unknown) {
    const text = String(value ?? '').trim();
    return text || null;
  }

  private normalizeKnowledgeBaseKey(value: string) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  private async getKnowledgeBaseOrThrow(id: string) {
    const item = await this.prisma.knowledgeBase.findUnique({ where: { id } });
    if (!item) throwError('NOT_FOUND');
    return item;
  }
}
