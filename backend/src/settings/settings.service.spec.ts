import { ConfigService } from '@nestjs/config';
import {
  AI_SETTING_KEYS,
  DEFAULT_SYSTEM_PROMPT,
  SettingsService,
} from './settings.service';

describe('SettingsService AI settings', () => {
  const prismaMock = {
    appSetting: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  } as any;

  const configMock = {
    get: jest.fn(),
  } as unknown as ConfigService;

  const service = new SettingsService(prismaMock, configMock);

  beforeEach(() => {
    jest.clearAllMocks();
    configMock.get = jest.fn(() => undefined) as any;
  });

  it('returns AI settings with normalized RAG bases and features', async () => {
    prismaMock.appSetting.findMany.mockResolvedValue([
      { key: AI_SETTING_KEYS.systemPrompt, value: 'System local' },
      { key: AI_SETTING_KEYS.baseUrl, value: 'http://litellm.internal' },
      { key: AI_SETTING_KEYS.apiKey, value: 'secret-key' },
      { key: AI_SETTING_KEYS.model, value: 'llama-3.3' },
      { key: AI_SETTING_KEYS.embeddingModel, value: 'bge-m3' },
      {
        key: AI_SETTING_KEYS.analysisSources,
        value: JSON.stringify({
          chatbot: ['missions', 'missions', 'tasks'],
          cpca_agent: ['complaints_cpca', 'tasks', 'complaints_cpca'],
        }),
      },
      {
        key: AI_SETTING_KEYS.analysisKnowledgeBases,
        value: JSON.stringify({
          chatbot: ['kb-cpca', 'kb-cpca', 'kb-smif'],
          cpca_agent: ['kb-ica-3013', 'kb-cpca'],
        }),
      },
      {
        key: AI_SETTING_KEYS.analysisFeatures,
        value: JSON.stringify({
          chatbot: ['rag_knowledge_bases', 'suggested_actions', 'invalid'],
          cpca_agent: [
            'structured_complaints',
            'cpca_case_inconsistencies',
            'traceability_links',
          ],
        }),
      },
    ]);

    const settings = await service.getAiSettings();

    expect(settings.systemPrompt).toBe('System local');
    expect(settings.baseUrl).toBe('http://litellm.internal');
    expect(settings.model).toBe('llama-3.3');
    expect(settings.embeddingModel).toBe('bge-m3');
    expect(settings.analysisSources.chatbot).toEqual(['missions', 'tasks']);
    expect(settings.analysisKnowledgeBases.chatbot).toEqual(['kb-cpca', 'kb-smif']);
    expect(settings.analysisFeatures.chatbot).toEqual([
      'rag_knowledge_bases',
      'suggested_actions',
    ]);
    expect(settings.analysisSources.cpca_agent).toEqual([
      'complaints_cpca',
      'tasks',
    ]);
    expect(settings.analysisKnowledgeBases.cpca_agent).toEqual([
      'kb-ica-3013',
      'kb-cpca',
    ]);
    expect(settings.analysisFeatures.cpca_agent).toEqual([
      'structured_complaints',
      'cpca_case_inconsistencies',
      'traceability_links',
    ]);
  });

  it('falls back to default AI prompt and features when settings are absent', async () => {
    prismaMock.appSetting.findMany.mockResolvedValue([]);
    prismaMock.appSetting.findUnique.mockResolvedValue(null);

    const settings = await service.getAiSettings();

    expect(settings.systemPrompt).toBe(DEFAULT_SYSTEM_PROMPT);
    await expect(service.getAnalysisFeaturesForType('chatbot')).resolves.toContain(
      'suggested_links',
    );
  });

  it('persists normalized knowledge bases and features updates', async () => {
    const setSpy = jest
      .spyOn(service, 'set')
      .mockResolvedValue(undefined as never);
    const syncSpy = jest
      .spyOn(service, 'syncLitellmOverrides')
      .mockResolvedValue(undefined);

    await service.updateAiSettings({
      embeddingModel: 'bge-m3',
      analysisKnowledgeBases: {
        chatbot: ['kb-cpca', '', 'kb-smif', 'kb-cpca'],
      },
      analysisFeatures: {
        chatbot: ['suggested_links', 'invalid' as any, 'suggested_links'],
      },
    });

    expect(setSpy).toHaveBeenCalledWith(AI_SETTING_KEYS.embeddingModel, 'bge-m3');

    const knowledgeBaseCall = setSpy.mock.calls.find(
      ([key]) => key === AI_SETTING_KEYS.analysisKnowledgeBases,
    );
    expect(knowledgeBaseCall).toBeDefined();
    expect(JSON.parse(String(knowledgeBaseCall?.[1]))).toMatchObject({
      chatbot: ['kb-cpca', 'kb-smif'],
    });

    const featureCall = setSpy.mock.calls.find(
      ([key]) => key === AI_SETTING_KEYS.analysisFeatures,
    );
    expect(featureCall).toBeDefined();
    expect(JSON.parse(String(featureCall?.[1]))).toMatchObject({
      chatbot: ['suggested_links'],
    });

    expect(syncSpy).toHaveBeenCalledTimes(1);
  });
});
