import { BiBestPracticesCycleService } from './bi-best-practices-cycle.service';

const baseRecord = {
  id: 41,
  api_id: 41,
  _aba: 'Respostas ao formulário 1',
  _linha: 42,
  carimbo_de_data_hora: '03/03/2026 11:02:11',
  pergunta_01_e_possivel_manter_o_rigor_tecnico_militar_na_formacao_de_turmas_mistas_compostas:
    'Concordo totalmente',
  pergunta_02_sinto_me_preparado_para_conduzir_a_formacao_de_turmas_mistas_compostas_por_recru:
    'Concordo parcialmente',
  pergunta_03_vieses_de_genero_diferencas_de_tratamento_entre_homens_e_mulheres_podem_influenc:
    'Discordo totalmente',
  pergunta_04_na_sua_avaliacao_ha_diferenca_na_forma_como_os_recrutas_interagem_entre_si_quand:
    'Não',
  pergunta_05_caso_tenha_assinalado_sim_na_pergunta_anterior_descreva_brevemente_essa_diferenc:
    '',
  pergunta_06_consigo_identificar_situacoes_no_contexto_da_instrucao_que_demandam_o_apoio_do_a:
    'Sempre',
  pergunta_07_na_sua_avaliacao_qual_e_o_principal_desafio_na_conducao_da_primeira_turma_femini:
    'Ajustar condutas e linguagem sem comprometer o rigor técnico-militar',
  identificacao: 'Gap-MN',
  especialidade: 'Serviço Social',
};

function apiPayload(
  records: unknown[],
  overrides: Record<string, unknown> = {},
) {
  return {
    ok: true,
    projeto: '03. Pesquisa Ciclo boas práticas',
    recurso: 'registros',
    atualizado_em: '2026-05-02T17:48:26.499Z',
    since_id: 0,
    count: records.length,
    total_disponivel_no_filtro: records.length,
    limit: 200,
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
    biBestPracticeCycleResponse: {
      findFirst: jest.fn().mockResolvedValue(null),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: responseDeleteMany,
    },
    biBestPracticeCycleImportBatch: {
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
    previewImportRows: jest.fn().mockResolvedValue({
      sourceType: 'BEST_PRACTICE_CYCLE',
      totalRows: 1,
      suggestions: [],
      unresolved: [],
      summary: {
        suggestionCount: 0,
        unresolvedCount: 0,
        omSuggestionCount: 0,
        specialtySuggestionCount: 0,
      },
    }),
    applyImportNormalization: jest.fn((rows) => ({
      rows,
      appliedSuggestions: 0,
      updatedFields: 0,
    })),
    rebuild: jest.fn().mockResolvedValue(undefined),
  };
}

describe('BiBestPracticesCycleService API import', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.BI_BEST_PRACTICES_CYCLE_API_URL;

  beforeEach(() => {
    process.env.BI_BEST_PRACTICES_CYCLE_API_URL =
      'https://script.example.test/exec?token=secret&since_id=0';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalEnv === undefined) {
      delete process.env.BI_BEST_PRACTICES_CYCLE_API_URL;
    } else {
      process.env.BI_BEST_PRACTICES_CYCLE_API_URL = originalEnv;
    }
    jest.clearAllMocks();
  });

  it('gera prévia incremental usando o maior apiId já importado', async () => {
    const prisma = makePrismaMock();
    prisma.biBestPracticeCycleResponse.findFirst.mockResolvedValue({
      apiId: 40,
    });
    const normalization = makeNormalizationMock();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () =>
        apiPayload([{ ...baseRecord }], {
          since_id: 40,
          next_since_id: 41,
          last_id_available: 41,
        }),
    });

    const service = new BiBestPracticesCycleService(
      prisma as any,
      normalization as any,
    );

    const result = await service.importResponsesFromApi(undefined, {
      previewOnly: true,
    });

    const requestedUrl = new URL((global.fetch as jest.Mock).mock.calls[0][0]);
    expect(requestedUrl.searchParams.get('since_id')).toBe('40');
    expect(result).toMatchObject({
      previewOnly: true,
      importMode: 'INCREMENTAL',
      sync: {
        sinceId: 40,
        fetchedRows: 1,
        nextSinceId: 41,
      },
    });
    expect(normalization.previewImportRows).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'BEST_PRACTICE_CYCLE',
        rows: [
          expect.objectContaining({
            rowNumber: 42,
            fields: [
              expect.objectContaining({
                fieldKey: 'identification',
                value: 'Gap-MN',
              }),
              expect.objectContaining({
                fieldKey: 'specialty',
                value: 'Serviço Social',
              }),
            ],
          }),
        ],
      }),
    );
    expect(prisma.biBestPracticeCycleImportBatch.create).not.toHaveBeenCalled();
  });

  it('zera a base e grava metadados da API', async () => {
    const prisma = makePrismaMock();
    prisma.biBestPracticeCycleResponse.createMany.mockResolvedValue({
      count: 1,
    });
    prisma.biBestPracticeCycleImportBatch.update.mockResolvedValue({
      id: 'batch-1',
      insertedRows: 1,
      duplicateRows: 0,
      invalidRows: 0,
    });

    const normalization = makeNormalizationMock();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () =>
        apiPayload([{ ...baseRecord }], {
          since_id: 0,
          next_since_id: 41,
          last_id_available: 41,
        }),
    });

    const service = new BiBestPracticesCycleService(
      prisma as any,
      normalization as any,
    );

    const result = await service.importResponsesFromApi(
      { id: 'user-1' } as any,
      {
        replaceAll: true,
      },
    );

    expect(prisma.biBestPracticeCycleResponse.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.biBestPracticeCycleImportBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fileName: 'Google Forms API - Ciclo de Boas Práticas',
          format: 'API',
          sheetName: 'Respostas ao formulário 1',
          apiSinceId: 0,
          apiNextSinceId: 41,
          apiLastIdAvailable: 41,
          importedById: 'user-1',
        }),
      }),
    );
    expect(prisma.biBestPracticeCycleResponse.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            batchId: 'batch-1',
            apiId: 41,
            sourceRow: 42,
            technicalRigorPerception: 'Concordo totalmente',
            preparednessToLeadMixedClass: 'Concordo parcialmente',
            supportNeedRecognition: 'Sempre',
            rawPayload: expect.objectContaining({
              api_id: '41',
              _linha: '42',
            }),
          }),
        ],
        skipDuplicates: true,
      }),
    );
    expect(normalization.rebuild).toHaveBeenCalledWith({
      sourceType: 'BEST_PRACTICE_CYCLE',
    });
    expect(result).toMatchObject({
      importMode: 'REPLACE',
      batch: { insertedRows: 1 },
    });
  });
});
