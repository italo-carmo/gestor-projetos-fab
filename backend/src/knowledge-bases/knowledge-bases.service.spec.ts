import { KnowledgeBaseTheme } from '@prisma/client';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import {
  KnowledgeBaseRagHit,
  KnowledgeBasesService,
} from './knowledge-bases.service';

const baseHit = (
  overrides: Partial<KnowledgeBaseRagHit> = {},
): KnowledgeBaseRagHit => ({
  chunkId: 'chunk-1',
  knowledgeBaseId: 'kb-1',
  knowledgeBaseName: 'Legislação CPCA',
  knowledgeBaseTheme: KnowledgeBaseTheme.CPCA,
  documentId: 'doc-1',
  documentTitle: 'Lei de proteção',
  fileName: 'lei.pdf',
  chunkIndex: 0,
  textContent: 'Trecho normativo relevante.',
  semanticScore: 0,
  lexicalScore: 0,
  fusedScore: 0,
  ...overrides,
});

describe('KnowledgeBasesService', () => {
  const prismaMock = {
    knowledgeBase: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    knowledgeBaseDocument: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  } as any;
  const auditMock = { log: jest.fn() } as any;
  const litellmMock = {
    createEmbeddings: jest.fn(),
  } as any;
  const settingsMock = {
    getEmbeddingModel: jest.fn(),
  } as any;
  const cipavdReportsMock = {} as any;

  const service = new KnowledgeBasesService(
    prismaMock,
    auditMock,
    litellmMock,
    settingsMock,
    cipavdReportsMock,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.knowledgeBase.findMany.mockResolvedValue([{ id: 'kb-1' }]);
    prismaMock.knowledgeBase.findUnique.mockReset();
    prismaMock.knowledgeBaseDocument.create.mockReset();
    prismaMock.knowledgeBaseDocument.update.mockReset();
    prismaMock.knowledgeBaseDocument.findUnique.mockReset();
  });

  it('builds prompt context and deep links back to the knowledge base admin tab', () => {
    const prompt = service.buildPromptContext([
      baseHit(),
      baseHit({
        chunkId: 'chunk-2',
        documentId: 'doc-2',
        documentTitle: 'Portaria complementar',
        chunkIndex: 2,
      }),
    ]);

    expect(prompt.text).toContain('[KB1] Base: Legislação CPCA');
    expect(prompt.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'KB1',
          href: '/admin?tab=knowledge-bases&baseId=kb-1&docId=doc-1',
        }),
      ]),
    );
  });

  it('fuses lexical and semantic ranking when embeddings are available', async () => {
    settingsMock.getEmbeddingModel.mockResolvedValue('bge-m3');
    litellmMock.createEmbeddings.mockResolvedValue({
      model: 'bge-m3',
      embeddings: [[0.1, 0.2, 0.3]],
    });
    jest.spyOn(service as any, 'searchLexical').mockResolvedValue([
      {
        ...baseHit({ chunkId: 'chunk-2', lexicalScore: 0.92 }),
        rank: 1,
      },
      {
        ...baseHit({ chunkId: 'chunk-1', lexicalScore: 0.61 }),
        rank: 2,
      },
    ]);
    jest.spyOn(service as any, 'searchSemantic').mockResolvedValue([
      {
        ...baseHit({ chunkId: 'chunk-1', semanticScore: 0.97 }),
        rank: 1,
      },
    ]);

    const result = await service.retrieveRelevantChunks({
      query: 'legislação cpca',
      knowledgeBaseIds: ['kb-1'],
      limit: 3,
    });

    expect(litellmMock.createEmbeddings).toHaveBeenCalledWith({
      model: 'bge-m3',
      input: 'legislação cpca',
    });
    expect(result.map((item) => item.chunkId)).toEqual(['chunk-1', 'chunk-2']);
    expect(result[0]?.fusedScore).toBeGreaterThan(result[1]?.fusedScore ?? 0);
  });

  it('falls back to lexical retrieval if semantic search fails', async () => {
    settingsMock.getEmbeddingModel.mockResolvedValue('bge-m3');
    litellmMock.createEmbeddings.mockRejectedValue(new Error('gateway indisponível'));
    jest.spyOn(service as any, 'searchLexical').mockResolvedValue([
      {
        ...baseHit({ chunkId: 'chunk-lexical', lexicalScore: 0.81 }),
        rank: 1,
      },
    ]);
    const semanticSpy = jest
      .spyOn(service as any, 'searchSemantic')
      .mockResolvedValue([]);

    const result = await service.retrieveRelevantChunks({
      query: 'protocolo cpca',
      knowledgeBaseIds: ['kb-1'],
      limit: 2,
    });

    expect(semanticSpy).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      chunkId: 'chunk-lexical',
      lexicalScore: 0.81,
    });
  });

  it('accepts the legacy pdf-parse function export', async () => {
    const legacyParser = jest.fn().mockResolvedValue({
      text: 'Conteudo extraido',
      numpages: 3,
    });

    const resolvedParser = (service as any).resolvePdfParseModule({
      default: legacyParser,
    });
    const result = await resolvedParser(Buffer.from('%PDF-1.4'));

    expect(legacyParser).toHaveBeenCalledWith(expect.any(Buffer));
    expect(result).toEqual({
      text: 'Conteudo extraido',
      numpages: 3,
    });
  });

  it('adapts the PDFParse class API when available', async () => {
    const getText = jest.fn().mockResolvedValue({
      text: 'Texto pela classe',
      total: 2,
    });
    const destroy = jest.fn().mockResolvedValue(undefined);
    const constructorSpy = jest.fn();
    class PDFParse {
      constructor(args: { data: Buffer }) {
        constructorSpy(args);
      }

      getText() {
        return getText();
      }

      destroy() {
        return destroy();
      }
    }

    const resolvedParser = (service as any).resolvePdfParseModule({ PDFParse });
    const result = await resolvedParser(Buffer.from('%PDF-1.7'));

    expect(constructorSpy).toHaveBeenCalledWith({ data: expect.any(Buffer) });
    expect(getText).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      text: 'Texto pela classe',
      total: 2,
    });
  });

  it('fails fast for unsupported pdf-parse module shapes', () => {
    expect(() => (service as any).resolvePdfParseModule({})).toThrow(
      'pdf-parse não exportou uma API de parsing compatível.',
    );
  });

  it('imports a CIPAVD report into a knowledge base with source metadata', async () => {
    const previousDir = process.env.KNOWLEDGE_BASE_DOCUMENTS_DIR;
    const workdir = await mkdtemp(path.join(tmpdir(), 'kb-import-'));
    process.env.KNOWLEDGE_BASE_DOCUMENTS_DIR = path.join(workdir, 'kb');
    const sourcePath = path.join(workdir, 'relatorio.pdf');
    await writeFile(sourcePath, Buffer.from('relatorio cipavd'));

    prismaMock.knowledgeBase.findUnique.mockResolvedValue({
      id: 'kb-1',
      key: 'base-cipavd',
      name: 'Base CIPAVD',
      theme: KnowledgeBaseTheme.CIPAVD,
    });
    prismaMock.knowledgeBaseDocument.create.mockResolvedValue({
      id: 'doc-1',
    });
    prismaMock.knowledgeBaseDocument.update.mockResolvedValue({
      id: 'doc-1',
    });
    prismaMock.knowledgeBaseDocument.findUnique.mockResolvedValue({
      id: 'doc-1',
      knowledgeBaseId: 'kb-1',
      title: 'Relatório importado',
      fileName: 'relatorio.pdf',
      fileUrl: '/admin/knowledge-bases/documents/doc-1/download',
      storageKey: 'stored.pdf',
      mimeType: 'application/pdf',
      fileSize: 16,
      checksum: 'sha',
      status: 'READY',
      contentText: null,
      parsedAt: null,
      lastIndexedAt: null,
      chunkCount: 0,
      indexError: null,
      metadataJson: null,
      createdAt: new Date('2026-06-01T00:00:00Z'),
      updatedAt: new Date('2026-06-01T00:00:00Z'),
      knowledgeBase: {
        id: 'kb-1',
        key: 'base-cipavd',
        name: 'Base CIPAVD',
        theme: KnowledgeBaseTheme.CIPAVD,
      },
      _count: { chunks: 0 },
    });
    cipavdReportsMock.getFileForKnowledgeBaseImport = jest
      .fn()
      .mockResolvedValue({
        id: 'report-1',
        name: 'relatorio.pdf',
        fileName: 'relatorio.pdf',
        filePath: sourcePath,
        mimeType: 'application/pdf',
        fileSize: 16,
        path: 'Relatórios / 2026 / relatorio.pdf',
        folderPath: 'Relatórios / 2026',
      });
    const reindexSpy = jest
      .spyOn(service, 'reindexDocument')
      .mockResolvedValue({} as any);

    const result = await service.importCipavdReportDocument(
      'kb-1',
      { fileId: 'report-1', title: 'Relatório importado' },
      { id: 'user-1' } as any,
    );

    const createCall = prismaMock.knowledgeBaseDocument.create.mock.calls[0][0];
    expect(createCall.data.metadataJson).toMatchObject({
      sourceType: 'cipavd_report',
      sourceId: 'report-1',
      sourcePath: 'Relatórios / 2026 / relatorio.pdf',
      sourceFolderPath: 'Relatórios / 2026',
      importedByUserId: 'user-1',
    });
    expect(reindexSpy).toHaveBeenCalledWith('doc-1', { id: 'user-1' });
    await expect(
      readFile(
        path.join(
          process.env.KNOWLEDGE_BASE_DOCUMENTS_DIR as string,
          createCall.data.storageKey,
        ),
        'utf-8',
      ),
    ).resolves.toBe('relatorio cipavd');
    expect(result.downloadUrl).toBe(
      '/admin/knowledge-bases/documents/doc-1/download',
    );

    reindexSpy.mockRestore();
    process.env.KNOWLEDGE_BASE_DOCUMENTS_DIR = previousDir;
    await rm(workdir, { recursive: true, force: true });
  });
});
