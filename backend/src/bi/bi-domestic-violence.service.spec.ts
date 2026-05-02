import { BiDomesticViolenceService } from './bi-domestic-violence.service';

const baseRecord = {
  carimbo_de_data_hora: '24/11/2025 11:29:55',
  idade: '24',
  organizacao_militar: 'Gap-MN',
  estado_civil: 'Solteira',
  escolaridade: 'Médio',
  naturalidade: 'Sudeste',
  vinculo_institucional_com_a_fab: 'Militar',
  caso_seja_militar_indique_o_posto_ou_graduacao_se_nao_for_militar_selecione_a_op:
    '3Sgt',
  voce_sofreu_algum_tipo_de_violencia_domestica_no_decorrer_de_sua_vida: 'Não',
  nos_ultimos_12_meses_voce_sofreu_algum_tipo_de_violencia_domestica: 'Não',
  as_proximas_perguntas_tratam_da_violencia_sofrida_indique_qual_situacao_voce_des:
    'Não se aplica - não sofri violência',
  frequencia_da_ocorrencia: 'Não se aplica - não sofri violência',
  tipo_de_vinculo_afetivo_com_o_autor: 'Não se aplica - não sofri violência',
  se_sofreu_violencia_qual_is_tipo_s_selecione_uma_ou_mais_respostas:
    'Não se aplica - não sofri violência',
  qual_e_o_tipo_de_vinculo_com_o_autor_do_fato:
    'Não se aplica - não sofri violência',
  o_autor_da_violencia_possui_vinculo_com_instituicao_militar:
    'Não possui vínculo com instituição de segurança pública',
  onde_ocorreu_o_fato: 'Não se aplica - não sofri violência',
  houve_testemunhas: 'Não',
  em_que_intensidade_voce_percebe_o_impacto_da_violencia_na_sua_vida:
    'Não se aplica - não sofri violência',
  em_quais_areas_voce_percebe_maior_impacto_marque_uma_opcao_ou_mais:
    'Não se aplica - não sofri violência',
  voce_procurou_algum_canal_de_denuncia: 'Não',
  se_sim_qual_marque_uma_alternativa_ou_mais:
    'Não se aplica - não sofri violência',
  se_nao_procurou_quais_foram_os_principais_motivos_para_nao_registrar_a_ocorrenci:
    'Não se aplica - não sofri violência',
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
    atualizado_em: '2026-05-02T12:08:40.701Z',
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
    biDomesticViolenceResponse: {
      findFirst: jest.fn().mockResolvedValue(null),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: responseDeleteMany,
    },
    biDomesticViolenceImportBatch: {
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
      sourceType: 'DOMESTIC_VIOLENCE',
      totalRows: 0,
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

describe('BiDomesticViolenceService API import', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.BI_DOMESTIC_VIOLENCE_API_URL;

  beforeEach(() => {
    process.env.BI_DOMESTIC_VIOLENCE_API_URL =
      'https://script.example.test/exec?token=secret&since_id=0';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalEnv === undefined) {
      delete process.env.BI_DOMESTIC_VIOLENCE_API_URL;
    } else {
      process.env.BI_DOMESTIC_VIOLENCE_API_URL = originalEnv;
    }
    jest.clearAllMocks();
  });

  it('gera prévia incremental usando o maior apiId já importado', async () => {
    const prisma = makePrismaMock();
    prisma.biDomesticViolenceResponse.findFirst.mockResolvedValue({
      apiId: 200,
    });
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

    const service = new BiDomesticViolenceService(
      prisma as any,
      normalization as any,
    );

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
    });
    expect(normalization.previewImportRows).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: expect.arrayContaining([
          expect.objectContaining({
            rowNumber: 202,
            fields: [
              expect.objectContaining({
                fieldKey: 'organization',
                value: 'GAP-MN',
              }),
            ],
          }),
        ]),
      }),
    );
    expect(prisma.biDomesticViolenceImportBatch.create).not.toHaveBeenCalled();
  });

  it('zera a base, aplica normalização e grava apiId no import via API', async () => {
    const prisma = makePrismaMock();
    prisma.biDomesticViolenceResponse.createMany.mockResolvedValue({
      count: 1,
    });
    prisma.biDomesticViolenceImportBatch.update.mockResolvedValue({
      id: 'batch-1',
      insertedRows: 1,
      duplicateRows: 0,
      invalidRows: 0,
    });

    const normalization = makeNormalizationMock();
    normalization.applyImportNormalization.mockImplementation((rows) => ({
      rows: rows.map((row: any) => ({
        ...row,
        organization: 'SERINFRA-MN',
      })),
      appliedSuggestions: 1,
      updatedFields: 1,
    }));

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () =>
        apiPayload(
          [
            {
              ...baseRecord,
              api_id: 1,
              id: 1,
              linha: 2,
              organizacao_militar: 'SERINFRA-MN ',
            },
          ],
          {
            since_id: 0,
            next_since_id: 1,
            last_id_available: 1,
          },
        ),
    });

    const service = new BiDomesticViolenceService(
      prisma as any,
      normalization as any,
    );

    const result = await service.importResponsesFromApi(
      { id: 'user-1' } as any,
      {
        replaceAll: true,
        normalizationPlan: { decisions: [{ id: 'x', apply: true }] },
      },
    );

    expect(prisma.biDomesticViolenceResponse.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.biDomesticViolenceImportBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fileName: 'Google Sheets API - Violência Doméstica',
          format: 'API',
          apiSinceId: 0,
          apiNextSinceId: 1,
          apiLastIdAvailable: 1,
          importedById: 'user-1',
        }),
      }),
    );
    expect(prisma.biDomesticViolenceResponse.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            batchId: 'batch-1',
            apiId: 1,
            organization: 'SERINFRA-MN',
            sourceRow: 2,
            rawPayload: expect.objectContaining({ api_id: 1 }),
          }),
        ],
        skipDuplicates: true,
      }),
    );
    expect(normalization.rebuild).toHaveBeenCalledWith({
      sourceType: 'DOMESTIC_VIOLENCE',
    });
    expect(result).toMatchObject({
      importMode: 'REPLACE',
      normalization: { suggestionsApplied: 1, updatedFields: 1 },
      batch: { insertedRows: 1 },
    });
  });
});
