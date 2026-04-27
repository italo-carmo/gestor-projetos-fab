import { KnowledgeBaseTheme } from '@prisma/client';
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
    },
  } as any;
  const auditMock = { log: jest.fn() } as any;
  const litellmMock = {
    createEmbeddings: jest.fn(),
  } as any;
  const settingsMock = {
    getEmbeddingModel: jest.fn(),
  } as any;

  const service = new KnowledgeBasesService(
    prismaMock,
    auditMock,
    litellmMock,
    settingsMock,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.knowledgeBase.findMany.mockResolvedValue([{ id: 'kb-1' }]);
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
});
