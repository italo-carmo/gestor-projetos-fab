import { BiCpcaMeetingService } from './bi-cpca-meeting.service';

const baseRecord = {
  id: 41,
  aba: 'Respostas ao formulário 1',
  linha: 42,
  carimbo_de_data_hora: '25/11/2025 14:41:22',
  q01_qual_a_sua_especialidade: 'SERVIÇO DE OBRAS',
  q02_voce_se_sente_confiante_para_aplicar_corretamente_os_procedimentos_administrativos_de_apur:
    'Concordo (4)',
  q03_voce_compreende_os_aspectos_juridicos_presentes_na_ica_30_13_2024:
    'Concordo (4)',
  q04_voce_se_sente_preparado_para_aplicar_tecnicas_de_escuta_ativa_e_empatica_ao_receber_um_rel:
    'Concordo (4)',
  q05_voce_se_sente_confiante_para_lidar_com_o_manejo_imediato_de_crises_emocionais_ex_choro_int:
    'Concordo (4)',
  q06_sua_cpca_possui_conhecimento_detalhado_da_rede_de_protecao_local_para_encaminhamento_de_vi:
    'Sim, parcialmente',
  q07_voce_considera_que_cpca_dispoe_de_recursos_logisticos_adequados_ex_sala_reservada_material:
    'Sim, parcialmente',
  q08_em_geral_voce_considera_que_os_militares_da_sua_om_demonstram_confianca_e_seguranca_para_p:
    'Sim, parcialmente',
  q09_apos_a_palestra_voce_se_sente_mais_preparado_a_para_identificar_e_prevenir_situacoes_de_as:
    'Sim, mais preparado(a)',
  q10_qual_e_o_maior_obstaculo_pratico_ex_tempo_sigilo_resistencia_do_efetivo_falta_de_conhecime:
    'Falta pleno conhecimento',
  comentarios_e_sugestoes: 'Manter as palestras',
  organizacao_militar: 'Gap-MN',
};

function apiPayload(
  records: unknown[],
  overrides: Record<string, unknown> = {},
) {
  return {
    ok: true,
    atualizado_em: '2026-05-02T13:03:50.685Z',
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
    biCpcaMeetingResponse: {
      findFirst: jest.fn().mockResolvedValue(null),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: responseDeleteMany,
    },
    biCpcaMeetingImportBatch: {
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
      sourceType: 'CPCA_MEETING',
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
    rebuild: jest.fn().mockResolvedValue(undefined),
  };
}

describe('BiCpcaMeetingService API import', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.BI_CPCA_MEETING_API_URL;

  beforeEach(() => {
    process.env.BI_CPCA_MEETING_API_URL =
      'https://script.example.test/exec?token=secret&sync=1&since_id=0';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalEnv === undefined) {
      delete process.env.BI_CPCA_MEETING_API_URL;
    } else {
      process.env.BI_CPCA_MEETING_API_URL = originalEnv;
    }
    jest.clearAllMocks();
  });

  it('gera prévia incremental usando o maior apiId já importado', async () => {
    const prisma = makePrismaMock();
    prisma.biCpcaMeetingResponse.findFirst.mockResolvedValue({ apiId: 40 });
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

    const service = new BiCpcaMeetingService(
      prisma as any,
      normalization as any,
    );

    const result = await service.importResponsesFromApi(undefined, {
      previewOnly: true,
    });

    const requestedUrl = new URL((global.fetch as jest.Mock).mock.calls[0][0]);
    expect(requestedUrl.searchParams.get('since_id')).toBe('40');
    expect(requestedUrl.searchParams.get('sync')).toBe('1');
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
        sourceType: 'CPCA_MEETING',
        rows: [
          expect.objectContaining({
            rowNumber: 42,
            fields: [
              expect.objectContaining({
                fieldKey: 'organizacao_militar',
                value: 'Gap-MN',
              }),
            ],
          }),
        ],
      }),
    );
    expect(prisma.biCpcaMeetingImportBatch.create).not.toHaveBeenCalled();
  });

  it('usa o endpoint padrão quando a URL não está configurada no ambiente', async () => {
    delete process.env.BI_CPCA_MEETING_API_URL;
    const prisma = makePrismaMock();
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

    const service = new BiCpcaMeetingService(
      prisma as any,
      normalization as any,
    );

    await service.importResponsesFromApi(undefined, { previewOnly: true });

    const requestedUrl = new URL((global.fetch as jest.Mock).mock.calls[0][0]);
    expect(requestedUrl.hostname).toBe('script.google.com');
    expect(requestedUrl.searchParams.get('sync')).toBe('1');
    expect(requestedUrl.searchParams.get('since_id')).toBe('0');
    expect(requestedUrl.searchParams.get('token')).toBeTruthy();
  });

  it('zera a base, aplica normalização e grava metadados da API', async () => {
    const prisma = makePrismaMock();
    prisma.biCpcaMeetingResponse.createMany.mockResolvedValue({ count: 1 });
    prisma.biCpcaMeetingImportBatch.update.mockResolvedValue({
      id: 'batch-1',
      insertedRows: 1,
      duplicateRows: 0,
      invalidRows: 0,
    });

    const normalization = makeNormalizationMock();
    normalization.previewImportRows.mockResolvedValue({
      sourceType: 'CPCA_MEETING',
      totalRows: 1,
      suggestions: [
        {
          id: 'OM:organizacao_militar:Gap-MN',
          sourceType: 'CPCA_MEETING',
          fieldKey: 'organizacao_militar',
          fieldLabel: 'Organização Militar',
          kind: 'OM',
          originalValue: 'Gap-MN',
          suggestedValue: 'GAP-MN',
          confidence: 0.94,
          resolutionMethod: 'OM_STRONG_HEURISTIC',
          reasoning: null,
          rowCount: 1,
          sampleRows: [42],
        },
      ],
      unresolved: [],
      summary: {
        suggestionCount: 1,
        unresolvedCount: 0,
        omSuggestionCount: 1,
        specialtySuggestionCount: 0,
      },
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () =>
        apiPayload([{ ...baseRecord }], {
          since_id: 0,
          next_since_id: 41,
          last_id_available: 41,
        }),
    });

    const service = new BiCpcaMeetingService(
      prisma as any,
      normalization as any,
    );

    const result = await service.importResponsesFromApi(
      { id: 'user-1' } as any,
      {
        replaceAll: true,
        normalizationPlan: {
          decisions: [{ id: 'OM:organizacao_militar:Gap-MN', apply: true }],
        },
      },
    );

    expect(prisma.biCpcaMeetingResponse.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.biCpcaMeetingImportBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fileName: 'Google Sheets API - Encontro CPCA',
          format: 'API',
          sheetName: 'Respostas ao formulário 1',
          apiSinceId: 0,
          apiNextSinceId: 41,
          apiLastIdAvailable: 41,
          importedById: 'user-1',
        }),
      }),
    );
    expect(prisma.biCpcaMeetingResponse.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            batchId: 'batch-1',
            apiId: 41,
            sourceRow: 42,
            answersJson: expect.objectContaining({
              organizacao_militar: 'GAP-MN',
            }),
            rawPayload: expect.objectContaining({
              'Organização Militar': 'GAP-MN',
              api_id: '41',
            }),
          }),
        ],
        skipDuplicates: true,
      }),
    );
    expect(normalization.rebuild).toHaveBeenCalledWith({
      sourceType: 'CPCA_MEETING',
    });
    expect(result).toMatchObject({
      importMode: 'REPLACE',
      normalization: { suggestionsApplied: 1, updatedFields: 1 },
      batch: { insertedRows: 1 },
    });
  });
});
