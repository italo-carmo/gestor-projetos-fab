import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  firstConfig,
  LITELLM_API_KEY_ENV_KEYS,
  LITELLM_BASE_URL_ENV_KEYS,
  LITELLM_MODEL_ENV_KEYS,
  setLitellmDbOverrides,
} from '../llm/litellm.service';
import {
  ANALYSIS_DEFAULT_SOURCES,
  type AnalysisSourceSelection,
  ALL_KNOWLEDGE_SOURCE_IDS,
  type AiAnalysisType,
  AI_ANALYSIS_TYPES,
  type AiKnowledgeSourceId,
} from '../ai/ai-knowledge-sources';

export const AI_SETTING_KEYS = {
  systemPrompt: 'ai.systemPrompt',
  baseUrl: 'ai.litellm.baseUrl',
  apiKey: 'ai.litellm.apiKey',
  model: 'ai.litellm.model',
  analysisSources: 'ai.analysisSources',
} as const;

export const ANALYSIS_PROMPT_KEYS: Record<string, string> = {
  executive: 'ai.prompt.executive',
  situational: 'ai.prompt.situational',
  aggressor: 'ai.prompt.aggressor',
  text: 'ai.prompt.text',
  geo: 'ai.prompt.geo',
};

export const DEFAULT_SYSTEM_PROMPT = `Você é um analista institucional da Força Aérea Brasileira (FAB), especializado no programa CIPAVD/SMIF de prevenção e combate ao assédio e violência doméstica.

REGRAS OBRIGATÓRIAS:
1. Responda EXCLUSIVAMENTE em português do Brasil. NUNCA use inglês, nem uma palavra sequer.
2. Baseie-se SOMENTE nos dados fornecidos no contexto JSON. Não invente números.
3. Use tom técnico, objetivo e institucional.
4. Estruture respostas em parágrafos curtos e claros.
5. Ao citar estatísticas, inclua o número absoluto e, quando disponível, o percentual.
6. Use formatação Markdown para organizar a resposta: títulos (##), **negrito**, listas, tabelas quando apropriado. Isso melhora a legibilidade.
7. NUNCA mostre seu raciocínio interno, cálculos auxiliares, rascunhos ou pensamentos. Entregue APENAS a análise final pronta.
 8. NÃO repita a pergunta ou as instruções. Vá direto à análise.`;

const isAllowedSource = (value: unknown): value is AiKnowledgeSourceId => {
  return (
    String(value).trim() !== '' &&
    ALL_KNOWLEDGE_SOURCE_IDS.includes(String(value) as AiKnowledgeSourceId)
  );
};

const mergeUniqueSources = (values: unknown): AiKnowledgeSourceId[] => {
  if (!Array.isArray(values)) return [];
  const parsed = values
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .filter((value, idx, arr) => arr.indexOf(value) === idx)
    .filter((value): value is AiKnowledgeSourceId => isAllowedSource(value));
  return parsed;
};

const parseAnalysisSources = (raw: unknown): AnalysisSourceSelection => {
  const fallback = { ...ANALYSIS_DEFAULT_SOURCES } as AnalysisSourceSelection;
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;
    const entries = Object.entries(parsed as Record<string, unknown>);
    for (const [type, values] of entries) {
      const validType = AI_ANALYSIS_TYPES.includes(type as AiAnalysisType);
      if (!validType) continue;
      const normalized = mergeUniqueSources(values);
      (fallback as Record<string, AiKnowledgeSourceId[]>)[type] = normalized;
    }
    return fallback;
  } catch {
    return fallback;
  }
};

const stringifyAnalysisSources = (
  sources: Partial<Record<string, unknown>>,
): string => JSON.stringify(sources);

const normalizeSourceSelectionForStorage = (
  input: Partial<Record<AiAnalysisType, unknown>>,
): AnalysisSourceSelection => {
  const result = { ...ANALYSIS_DEFAULT_SOURCES } as AnalysisSourceSelection;
  for (const type of AI_ANALYSIS_TYPES) {
    if (!(type in input)) continue;
    const normalized = mergeUniqueSources(input[type]);
    (result as Record<string, AiKnowledgeSourceId[]>)[type] = normalized;
  }
  return result;
};

const pickConfiguredValue = (
  dbValue: string | null | undefined,
  envValue: string | undefined,
): string => {
  const fromDb = String(dbValue ?? '').trim();
  if (fromDb) return fromDb;
  return String(envValue ?? '').trim();
};

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.syncLitellmOverrides();
  }

  private get appSetting() {
    return (this.prisma as any).appSetting;
  }

  async get(key: string): Promise<string | null> {
    const row = await this.appSetting.findUnique({ where: { key } });
    return row?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  async getAiSettings(): Promise<{
    systemPrompt: string;
    baseUrl: string;
    apiKey: string;
    apiKeyMasked: string;
    model: string;
    analysisPrompts: Record<string, string>;
    analysisSources: AnalysisSourceSelection;
  }> {
    const allKeys = [
      ...Object.values(AI_SETTING_KEYS),
      ...Object.values(ANALYSIS_PROMPT_KEYS),
    ];
    const rows: { key: string; value: string }[] =
      await this.appSetting.findMany({
        where: { key: { in: allKeys } },
      });
    const map = new Map<string, string>(rows.map((r) => [r.key, r.value]));
    const rawSources = map.get(AI_SETTING_KEYS.analysisSources);
    const analysisSources = parseAnalysisSources(rawSources);

    const analysisPrompts: Record<string, string> = {};
    for (const [type, key] of Object.entries(ANALYSIS_PROMPT_KEYS)) {
      analysisPrompts[type] = map.get(key) ?? '';
    }

    const runtimeBaseUrl = pickConfiguredValue(
      map.get(AI_SETTING_KEYS.baseUrl),
      firstConfig(this.config, [
        ...LITELLM_BASE_URL_ENV_KEYS,
      ]),
    );
    const runtimeApiKey = pickConfiguredValue(
      map.get(AI_SETTING_KEYS.apiKey),
      firstConfig(this.config, [
        ...LITELLM_API_KEY_ENV_KEYS,
      ]),
    );
    const runtimeModel = pickConfiguredValue(
      map.get(AI_SETTING_KEYS.model),
      firstConfig(this.config, [
        ...LITELLM_MODEL_ENV_KEYS,
      ]),
    );

    return {
      systemPrompt:
        map.get(AI_SETTING_KEYS.systemPrompt) ?? DEFAULT_SYSTEM_PROMPT,
      baseUrl: runtimeBaseUrl,
      apiKey: runtimeApiKey,
      apiKeyMasked: runtimeApiKey
        ? `${runtimeApiKey.slice(0, 5)}${'*'.repeat(Math.max(0, runtimeApiKey.length - 5))}`
        : '',
      model: runtimeModel,
      analysisPrompts,
      analysisSources,
    };
  }

  async getAnalysisSources(): Promise<AnalysisSourceSelection> {
    const row = await this.appSetting.findUnique({
      where: { key: AI_SETTING_KEYS.analysisSources },
    });
    return parseAnalysisSources(row?.value ?? null);
  }

  async getAnalysisSourcesForType(
    type: AiAnalysisType,
  ): Promise<AiKnowledgeSourceId[]> {
    const rows = await this.getAnalysisSources();
    return rows[type] ?? ANALYSIS_DEFAULT_SOURCES[type];
  }

  async updateAiSettings(
    patch: Partial<{
      systemPrompt: string;
      baseUrl: string;
      apiKey: string;
      model: string;
      analysisPrompts: Record<string, string>;
      analysisSources: Partial<Record<string, AiKnowledgeSourceId[]>>;
    }>,
  ): Promise<void> {
    const ops: Promise<any>[] = [];
    if (patch.systemPrompt !== undefined) {
      ops.push(this.set(AI_SETTING_KEYS.systemPrompt, patch.systemPrompt));
    }
    if (patch.baseUrl !== undefined) {
      ops.push(this.set(AI_SETTING_KEYS.baseUrl, patch.baseUrl));
    }
    if (patch.apiKey !== undefined) {
      ops.push(this.set(AI_SETTING_KEYS.apiKey, patch.apiKey));
    }
    if (patch.model !== undefined) {
      ops.push(this.set(AI_SETTING_KEYS.model, patch.model));
    }
    if (patch.analysisPrompts) {
      for (const [type, value] of Object.entries(patch.analysisPrompts)) {
        const key = ANALYSIS_PROMPT_KEYS[type];
        if (key) ops.push(this.set(key, value));
      }
    }

    if (patch.analysisSources) {
      const normalized = normalizeSourceSelectionForStorage(
        patch.analysisSources,
      );
      ops.push(
        this.set(
          AI_SETTING_KEYS.analysisSources,
          stringifyAnalysisSources(normalized),
        ),
      );
    }

    await Promise.all(ops);
    await this.syncLitellmOverrides();
  }

  async syncLitellmOverrides(): Promise<void> {
    try {
      const settings = await this.getAiSettings();
      setLitellmDbOverrides({
        apiKey: settings.apiKey || undefined,
        baseUrl: settings.baseUrl || undefined,
        model: settings.model || undefined,
      });
      this.logger.log('LiteLLM DB overrides sincronizados.');
    } catch (e) {
      this.logger.warn(`Falha ao sincronizar overrides: ${e}`);
    }
  }

  async getSystemPrompt(): Promise<string> {
    const val = await this.get(AI_SETTING_KEYS.systemPrompt);
    return val || DEFAULT_SYSTEM_PROMPT;
  }

  async getAnalysisPrompt(type: string): Promise<string | null> {
    const key = ANALYSIS_PROMPT_KEYS[type];
    if (!key) return null;
    const val = await this.get(key);
    return val || null;
  }
}
