import { AiService } from './ai.service';

const parseSseEvent = (chunk: string) => {
  const match = chunk.match(/^event:\s*(.+)\ndata:\s*(.+)\n\n$/s);
  if (!match) {
    throw new Error(`Chunk SSE inválido: ${chunk}`);
  }
  return {
    event: match[1],
    data: JSON.parse(match[2]),
  };
};

const collectSse = async (stream: AsyncGenerator<string>) => {
  const events: Array<{ event: string; data: any }> = [];
  for await (const chunk of stream) {
    events.push(parseSseEvent(chunk));
  }
  return events;
};

const situationalDashboard = {
  surveys: {
    totalResponses: 120,
    violenceRatePercent: 14.2,
  },
  domesticViolence: {
    totalResponses: 40,
    lifetimeYes: 9,
    lifetimeRatePercent: 22.5,
    last12MonthsRatePercent: 7.5,
  },
  recruits: {
    totalResponses: 18,
    safeToReportPercent: 72.1,
    knowReportProcessPercent: 61.4,
  },
  complaints: {
    totalCases: 17,
    openCases: 6,
    concludedCases: 11,
    byCpca: 10,
    bySmif: 7,
    moral: 12,
    sexual: 5,
  },
  activities: {
    totalActivities: 9,
    done: 7,
    smif: 5,
    cipavd: 4,
  },
  missions: {
    totalMissions: 3,
    smif: 2,
    cipavd: 1,
    localitiesCovered: 6,
  },
  tasks: {
    totalTasks: 14,
    totalOverdue: 2,
    pending: 5,
    completed: 9,
  },
};

describe('AiService', () => {
  const litellmMock = {
    getDefaultModel: jest.fn(() => 'llama-local'),
    chatCompletion: jest.fn(),
    chatCompletionStream: jest.fn(),
  } as any;

  const settingsMock = {
    getSystemPrompt: jest.fn(),
    getAnalysisPrompt: jest.fn(),
    getAnalysisSourcesForType: jest.fn(),
    getAnalysisKnowledgeBasesForType: jest.fn(),
    getAnalysisFeaturesForType: jest.fn(),
  } as any;

  const strategicMock = {
    situationalDashboard: jest.fn(),
    aggressorProfile: jest.fn(),
    textAnalysis: jest.fn(),
    geoMap: jest.fn(),
    aiSourceReferences: jest.fn(),
    comgepSituationRoom: jest.fn(),
  } as any;

  const knowledgeBasesMock = {
    retrieveRelevantChunks: jest.fn(),
    buildPromptContext: jest.fn(),
  } as any;

  const cpcaMock = {
    buildAiContext: jest.fn(),
  } as any;

  const service = new AiService(
    litellmMock,
    settingsMock,
    strategicMock,
    knowledgeBasesMock,
    cpcaMock,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    settingsMock.getSystemPrompt.mockResolvedValue('SYSTEM');
    settingsMock.getAnalysisPrompt.mockResolvedValue(null);
    settingsMock.getAnalysisSourcesForType.mockResolvedValue(['missions']);
    settingsMock.getAnalysisKnowledgeBasesForType.mockResolvedValue(['kb-cpca']);
    strategicMock.situationalDashboard.mockResolvedValue(situationalDashboard);
    strategicMock.aggressorProfile.mockResolvedValue({});
    strategicMock.textAnalysis.mockResolvedValue({});
    strategicMock.geoMap.mockResolvedValue({});
    strategicMock.aiSourceReferences.mockResolvedValue([
      {
        id: 'SRC1',
        label: 'Painel BI',
        description: 'Resumo estruturado',
        href: '/dashboard/bi',
      },
    ]);
    strategicMock.comgepSituationRoom.mockResolvedValue({
      details: {},
    });
    knowledgeBasesMock.retrieveRelevantChunks.mockResolvedValue([
      {
        chunkId: 'chunk-1',
        knowledgeBaseId: 'kb-cpca',
        knowledgeBaseName: 'Base CPCA',
        knowledgeBaseTheme: 'CPCA',
        documentId: 'doc-1',
        documentTitle: 'Lei CPCA',
        fileName: 'lei-cpca.pdf',
        chunkIndex: 0,
        textContent: 'Trecho legal relevante para a CPCA.',
        semanticScore: 0.88,
        lexicalScore: 0.76,
        fusedScore: 0.04,
      },
    ]);
    knowledgeBasesMock.buildPromptContext.mockReturnValue({
      text: '[KB1] Base: Base CPCA\nDocumento: Lei CPCA\nTrecho recuperado: Trecho legal relevante para a CPCA.',
      references: [
        {
          id: 'KB1',
          label: 'Base CPCA • Lei CPCA',
          description: 'Trecho 1',
          href: '/admin?tab=knowledge-bases&baseId=kb-cpca&docId=doc-1',
        },
      ],
    });
    cpcaMock.buildAiContext.mockResolvedValue({
      generatedAt: '2026-04-21T12:00:00.000Z',
      summary: {
        totalCases: 12,
        openCases: 5,
        concludedCases: 4,
        archivedCases: 3,
        moralCases: 7,
        sexualCases: 5,
        inconsistentCases: 2,
      },
      topStatus: [{ status: 'RECEIVED', count: 5 }],
      topProcedures: [{ procedureType: 'NOT_DEFINED', count: 4 }],
      topOms: [{ omId: 'om-1', omLabel: 'BACG • Base Aérea de Campo Grande', count: 3 }],
      recentCases: [],
      matchedCases: [
        {
          caseId: 'case-1',
          caseNumber: 'CPCA-2026-BACG-00001',
          omId: 'om-1',
          omLabel: 'BACG • Base Aérea de Campo Grande',
          status: 'RECEIVED',
          complaintType: 'MORAL',
          detailedViolenceType: 'ASSEDIO_MORAL',
          procedureType: 'NOT_DEFINED',
          procedureCurrentSituation: 'NAO_INFORMADO',
          reportedAt: '2026-04-10T12:00:00.000Z',
          incidentDate: '2026-04-08T12:00:00.000Z',
          openDays: 11,
          retaliationRisk: true,
          link: '/cpca-cases?q=CPCA-2026-BACG-00001',
          inconsistencyCodes: ['ICA_25_26'],
          inconsistencies: [
            {
              code: 'ICA_25_26',
              badgeLabel: 'Art. 25/26',
              headline: 'Possível inconsistência de enquadramento',
              summary: 'Resumo',
              referenceTitle: 'ICA 30-13, arts. 25 e 26',
              tone: 'warning',
            },
          ],
        },
      ],
      criticalCases: [],
      inconsistentCases: [],
      inconsistencySummary: [
        {
          code: 'ICA_25_26',
          badgeLabel: 'Art. 25/26',
          headline: 'Possível inconsistência de enquadramento',
          tone: 'warning',
          count: 2,
        },
      ],
      normativeReferences: [
        {
          code: 'ICA_25_26',
          referenceTitle: 'ICA 30-13, arts. 25 e 26',
          referenceBody: 'Texto normativo',
        },
      ],
      references: [
        {
          id: 'case-1',
          label: 'CPCA-2026-BACG-00001 • BACG',
          description: 'Possível inconsistência de enquadramento',
          href: '/cpca-cases?q=CPCA-2026-BACG-00001',
        },
      ],
    });
  });

  it('uses knowledge base context in chatbot responses and respects disabled suggestion features', async () => {
    settingsMock.getAnalysisFeaturesForType.mockResolvedValue([
      'structured_situational',
      'rag_knowledge_bases',
      'traceability_links',
    ]);
    litellmMock.chatCompletion.mockResolvedValue({
      content: '## Resposta\nUse a base KB1 para orientar a atuação.',
      model: 'llama-local',
    });

    const events = await collectSse(service.chatStream('Preciso de uma missão?', [], 'chatbot'));
    const done = events.find((event) => event.event === 'done');

    expect(done).toBeDefined();
    expect(done?.data.model).toBe('llama-local');
    expect(done?.data.narrative).toContain('## Referências dos Dados');
    expect(done?.data.narrative).toContain('/admin?tab=knowledge-bases&baseId=kb-cpca&docId=doc-1');
    expect(done?.data.suggestedLinks).toEqual([]);
    expect(done?.data.suggestedActions).toEqual([]);
    expect(knowledgeBasesMock.retrieveRelevantChunks).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'Preciso de uma missão?',
        knowledgeBaseIds: ['kb-cpca'],
      }),
    );
    expect(litellmMock.chatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining(
              'Trechos recuperados da base de conhecimento',
            ),
          }),
        ]),
      }),
    );
  });

  it('falls back to deterministic situational analysis when LiteLLM stream fails', async () => {
    settingsMock.getAnalysisFeaturesForType.mockResolvedValue([
      'structured_situational',
      'rag_knowledge_bases',
      'traceability_links',
    ]);
    litellmMock.chatCompletionStream.mockImplementation(
      () =>
        (async function* () {
          throw new Error('Path /v1/chat/completions not found');
        })(),
    );

    const events = await collectSse(service.analyzeStream('situational'));
    const done = events.find((event) => event.event === 'done');

    expect(done).toBeDefined();
    expect(done?.data.model).toBe('local-fallback');
    expect(done?.data.narrative).toContain('## Síntese situacional');
    expect(done?.data.narrative).toContain('## Referências dos Dados');
    expect(done?.data.narrative).toContain('/admin?tab=knowledge-bases&baseId=kb-cpca&docId=doc-1');
  });

  it('falls back locally for COMGEP copilots and skips the room when the feature is disabled', async () => {
    settingsMock.getAnalysisSourcesForType.mockResolvedValue([]);
    settingsMock.getAnalysisFeaturesForType.mockResolvedValue([
      'rag_knowledge_bases',
      'traceability_links',
    ]);
    litellmMock.chatCompletionStream.mockImplementation(
      () =>
        (async function* () {
          throw new Error('Path /v1/chat/completions not found');
        })(),
    );

    const events = await collectSse(service.runActionAgentStream('briefing_comgep'));
    const done = events.find((event) => event.event === 'done');

    expect(done).toBeDefined();
    expect(done?.data.model).toBe('local-fallback');
    expect(done?.data.sessionId).toEqual(expect.any(String));
    expect(done?.data.narrative).toContain('## Referências dos Dados');
    expect(strategicMock.comgepSituationRoom).not.toHaveBeenCalled();
  });

  it('injects CPCA case context and case references for the CPCA agent profile', async () => {
    settingsMock.getAnalysisSourcesForType.mockResolvedValue([
      'complaints_cpca',
      'tasks',
    ]);
    settingsMock.getAnalysisKnowledgeBasesForType.mockResolvedValue([
      'kb-cpca',
      'kb-ica-3013',
    ]);
    settingsMock.getAnalysisFeaturesForType.mockResolvedValue([
      'structured_situational',
      'structured_complaints',
      'rag_knowledge_bases',
      'traceability_links',
      'cpca_case_inconsistencies',
    ]);
    litellmMock.chatCompletion.mockResolvedValue({
      content: '## Diagnóstico\nO caso CPCA-2026-BACG-00001 exige revisão.',
      model: 'llama-local',
    });

    const events = await collectSse(
      service.chatStream(
        'Analise inconsistências do caso CPCA-2026-BACG-00001',
        [],
        'cpca_agent',
      ),
    );
    const done = events.find((event) => event.event === 'done');

    expect(cpcaMock.buildAiContext).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'Analise inconsistências do caso CPCA-2026-BACG-00001',
        includeInconsistencies: true,
      }),
    );
    expect(litellmMock.chatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('"painelCpca"'),
          }),
        ]),
      }),
    );
    expect(done?.data.narrative).toContain('/cpca-cases?q=CPCA-2026-BACG-00001');
  });
});
