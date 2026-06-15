import { BiRecruitsService } from './bi-recruits.service';

const baseRecord = {
  carimbo_de_data_hora: '03/03/2026 14:14:23',
  escolaridade: 'Ensino Médio completo',
  genero: 'Feminino',
  identifica_assedio: 'Não',
  compreende_limites_conduta: 'Sim',
  sabe_recorrer_orientacao: 'Sim',
  sabe_registrar_ocorrencia: 'Sim',
  disposicao_procurar_orientacao: 'Seguro(a)',
  disposicao_registrar_ocorrencia: 'Seguro(a)',
  influencia_ingresso_fab: 'Desenvolvimento pessoal',
  sugestao_comentario: '',
  api_id: 201,
  id: 201,
  aba: 'Respostas ao formulário 1',
  linha: 202,
};

function apiPayload(
  records: unknown[],
  overrides: Record<string, unknown> = {},
) {
  return {
    ok: true,
    atualizado_em: '2026-06-15T19:21:43.458Z',
    since_id: 0,
    count: records.length,
    has_more: false,
    next_since_id: 0,
    last_id_available: 0,
    sheets: ['Respostas ao formulário 1'],
    dados: records,
    ...overrides,
  };
}

function makePrismaMock() {
  const responseDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
  const batchDeleteMany = jest.fn().mockResolvedValue({ count: 0 });

  return {
    biRecruitsResponse: {
      findFirst: jest.fn().mockResolvedValue(null),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: responseDeleteMany,
    },
    biRecruitsImportBatch: {
      create: jest.fn().mockResolvedValue({ id: 'batch-1' }),
      update: jest.fn().mockResolvedValue({
        id: 'batch-1',
        insertedRows: 0,
        duplicateRows: 0,
        invalidRows: 0,
      }),
      deleteMany: batchDeleteMany,
    },
    $transaction: jest.fn((items: Array<Promise<unknown>>) =>
      Promise.all(items),
    ),
  };
}

function makeNormalizationMock() {
  return {
    rebuild: jest.fn().mockResolvedValue(undefined),
  };
}

describe('BiRecruitsService API import', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.BI_RECRUITS_API_URL;

  beforeEach(() => {
    process.env.BI_RECRUITS_API_URL =
      'https://script.example.test/exec?token=secret&since_id=0';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalEnv === undefined) {
      delete process.env.BI_RECRUITS_API_URL;
    } else {
      process.env.BI_RECRUITS_API_URL = originalEnv;
    }
    jest.clearAllMocks();
  });

  it('gera prévia incremental usando o maior apiId já importado', async () => {
    const prisma = makePrismaMock();
    prisma.biRecruitsResponse.findFirst.mockResolvedValue({ apiId: 200 });
    const normalization = makeNormalizationMock();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () =>
        apiPayload(
          [{ ...baseRecord }, { ...baseRecord, api_id: 202, id: 202 }],
          {
            since_id: 200,
            next_since_id: 202,
            last_id_available: 202,
          },
        ),
    });

    const service = new BiRecruitsService(prisma as any, normalization as any);

    const result = await service.importResponsesFromApi(undefined, {
      previewOnly: true,
    });

    const requestedUrl = new URL((global.fetch as jest.Mock).mock.calls[0][0]);
    expect(requestedUrl.searchParams.get('since_id')).toBe('200');
    expect(result).toMatchObject({
      previewOnly: true,
      importMode: 'INCREMENTAL',
      sync: {
        sinceId: 200,
        fetchedRows: 2,
        nextSinceId: 202,
      },
      preview: [
        expect.objectContaining({
          apiId: 201,
          gender: 'Feminino',
          willingnessReport: 'Seguro(a)',
        }),
        expect.objectContaining({
          apiId: 202,
        }),
      ],
    });
    expect(prisma.biRecruitsImportBatch.create).not.toHaveBeenCalled();
  });

  it('zera a base e grava apiId no import via API', async () => {
    const prisma = makePrismaMock();
    prisma.biRecruitsResponse.createMany.mockResolvedValue({ count: 1 });
    prisma.biRecruitsImportBatch.update.mockResolvedValue({
      id: 'batch-1',
      insertedRows: 1,
      duplicateRows: 0,
      invalidRows: 0,
    });

    const normalization = makeNormalizationMock();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () =>
        apiPayload(
          [{ ...baseRecord, api_id: 1, id: 1, linha: 2 }],
          {
            since_id: 0,
            next_since_id: 1,
            last_id_available: 1,
          },
        ),
    });

    const service = new BiRecruitsService(prisma as any, normalization as any);

    const result = await service.importResponsesFromApi(
      { id: 'user-1' } as any,
      { replaceAll: true },
    );

    expect(prisma.biRecruitsResponse.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.biRecruitsImportBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fileName: 'Google Sheets API - Recrutas',
          format: 'API',
          apiSinceId: 0,
          apiNextSinceId: 1,
          apiLastIdAvailable: 1,
          importedById: 'user-1',
        }),
      }),
    );
    expect(prisma.biRecruitsResponse.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            batchId: 'batch-1',
            apiId: 1,
            gender: 'Feminino',
            sourceRow: 2,
            rawPayload: expect.objectContaining({ api_id: 1 }),
          }),
        ],
        skipDuplicates: true,
      }),
    );
    expect(normalization.rebuild).toHaveBeenCalledWith({
      sourceType: 'RECRUITS',
    });
    expect(result).toMatchObject({
      importMode: 'REPLACE',
      batch: { insertedRows: 1 },
      sync: { fetchedRows: 1 },
    });
  });
});
