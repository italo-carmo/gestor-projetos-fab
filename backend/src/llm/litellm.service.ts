import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ChatRole = 'system' | 'user' | 'assistant';
export type ChatMessage = { role: ChatRole; content: string };

export type ChatCompletionParams = {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
};

type OpenAiChoiceMessage = { content?: string | null };
type OpenAiChatResponse = {
  model?: string;
  choices?: { message?: OpenAiChoiceMessage }[];
  error?: { message?: string };
};

export function stripEnvQuotes(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  const t = value.trim();
  if (t.length >= 2) {
    const a = t[0];
    const b = t[t.length - 1];
    if ((a === '"' && b === '"') || (a === "'" && b === "'")) {
      return t.slice(1, -1).trim();
    }
  }
  return t;
}

function openAiV1Base(baseUrl: string): string {
  const u = baseUrl.trim().replace(/\/+$/, '');
  if (u.endsWith('/v1')) return u;
  return `${u}/v1`;
}

export function firstConfig(
  config: ConfigService,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const fromEnv = stripEnvQuotes(process.env[key]);
    if (fromEnv) return fromEnv;
    const fromConfig = stripEnvQuotes(config.get<string>(key));
    if (fromConfig) return fromConfig;
  }
  return undefined;
}

export const LITELLM_API_KEY_ENV_KEYS = [
  'API_LITELLM',
  'LITELLM_API_KEY',
  'OPENAI_API_KEY',
] as const;

export const LITELLM_BASE_URL_ENV_KEYS = [
  'API_LITELLM_BASE_URL',
  'LITELLM_BASE_URL',
  'OPENAI_BASE_URL',
] as const;

export const LITELLM_MODEL_ENV_KEYS = [
  'API_LITELLM_MODEL',
  'LITELLM_MODEL',
  'OPENAI_MODEL',
] as const;

export const LITELLM_DEFAULT_GPT_OSS = 'gpt-oss:20b';

export function normalizeLitellmModelId(
  raw: string,
  config: ConfigService,
): string {
  let m = raw.trim();
  if (!m) return LITELLM_DEFAULT_GPT_OSS;
  const low = m.toLowerCase().replace(/_/g, '-');
  if (low === 'gpt-oss-20b' || low === 'gptoss-20b') {
    m = LITELLM_DEFAULT_GPT_OSS;
  }
  const styleFlag = firstConfig(config, [
    'API_LITELLM_OPENAI_STYLE_MODEL',
    'LITELLM_OPENAI_STYLE_MODEL',
  ]);
  const openAiStyle =
    styleFlag === '1' ||
    String(styleFlag ?? '').trim().toLowerCase() === 'true';
  const mLow = m.toLowerCase();
  if (
    openAiStyle &&
    !m.includes('/') &&
    mLow.startsWith('gpt-oss:') &&
    !mLow.startsWith('openai/')
  ) {
    return `openai/${m.replace(/:/g, '-')}`;
  }
  return m;
}

/**
 * Override values injected at runtime from AppSetting (DB).
 * Set by SettingsService on startup and after admin updates.
 */
let dbOverrides: {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
} = {};

export function setLitellmDbOverrides(o: typeof dbOverrides) {
  dbOverrides = { ...o };
}

@Injectable()
export class LitellmService {
  private readonly logger = new Logger(LitellmService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.getApiKey() && this.getBaseUrl());
  }

  getBaseUrl(): string | undefined {
    return (
      dbOverrides.baseUrl ||
      firstConfig(this.config, [...LITELLM_BASE_URL_ENV_KEYS])
    );
  }

  getApiKey(): string | undefined {
    return (
      dbOverrides.apiKey ||
      firstConfig(this.config, [...LITELLM_API_KEY_ENV_KEYS])
    );
  }

  getDefaultModel(): string {
    const raw =
      dbOverrides.model ||
      firstConfig(this.config, [...LITELLM_MODEL_ENV_KEYS])?.trim() ||
      LITELLM_DEFAULT_GPT_OSS;
    return normalizeLitellmModelId(raw, this.config);
  }

  private resolveModel(explicit?: string): string {
    return explicit?.trim()
      ? normalizeLitellmModelId(explicit, this.config)
      : this.getDefaultModel();
  }

  private buildHeaders(apiKey: string) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };
  }

  async chatCompletion(
    params: ChatCompletionParams,
  ): Promise<{ content: string; model: string }> {
    const apiKey = this.getApiKey();
    const baseUrl = this.getBaseUrl();
    if (!apiKey || !baseUrl) {
      throw new Error(
        'LiteLLM não configurado. Configure via Administração > IA ou defina no .env.',
      );
    }

    const model = this.resolveModel(params.model);
    const url = `${openAiV1Base(baseUrl)}/chat/completions`;
    const body = {
      model,
      messages: params.messages,
      temperature: params.temperature ?? 0.35,
      max_tokens: params.max_tokens ?? 2048,
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(apiKey),
        body: JSON.stringify(body),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`LiteLLM request failed: ${msg}`);
      throw new Error(`Falha de rede ao contatar LiteLLM: ${msg}`);
    }

    const text = await res.text();
    let data: OpenAiChatResponse;
    try {
      data = JSON.parse(text) as OpenAiChatResponse;
    } catch {
      this.logger.warn(
        `LiteLLM resposta não-JSON (${res.status}): ${text.slice(0, 500)}`,
      );
      throw new Error(
        res.ok
          ? 'Resposta inválida do LiteLLM (não é JSON).'
          : `LiteLLM retornou HTTP ${res.status}.`,
      );
    }

    if (!res.ok) {
      const errMsg = data.error?.message || text.slice(0, 800);
      this.logger.warn(`LiteLLM HTTP ${res.status}: ${errMsg}`);
      throw new Error(errMsg || `LiteLLM HTTP ${res.status}`);
    }

    const content = data.choices?.[0]?.message?.content?.trim() ?? '';
    if (!content) {
      throw new Error('LiteLLM não retornou conteúdo na resposta.');
    }
    return { content, model: data.model ?? model };
  }

  /**
   * Streaming chat completions. Yields delta text chunks.
   * Uses OpenAI SSE protocol (stream: true).
   */
  async *chatCompletionStream(
    params: ChatCompletionParams,
  ): AsyncGenerator<{ type: 'token'; text: string } | { type: 'done'; model: string }> {
    const apiKey = this.getApiKey();
    const baseUrl = this.getBaseUrl();
    if (!apiKey || !baseUrl) {
      throw new Error(
        'LiteLLM não configurado. Configure via Administração > IA ou defina no .env.',
      );
    }

    const model = this.resolveModel(params.model);
    const url = `${openAiV1Base(baseUrl)}/chat/completions`;
    const body = {
      model,
      messages: params.messages,
      temperature: params.temperature ?? 0.35,
      max_tokens: params.max_tokens ?? 2048,
      stream: true,
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(apiKey),
        body: JSON.stringify(body),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Falha de rede ao contatar LiteLLM: ${msg}`);
    }

    if (!res.ok) {
      const text = await res.text();
      let errMsg = text.slice(0, 800);
      try {
        const j = JSON.parse(text);
        errMsg = j?.error?.message || errMsg;
      } catch { /* keep raw */ }
      throw new Error(errMsg || `LiteLLM HTTP ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('Sem body na resposta SSE do LiteLLM.');

    const decoder = new TextDecoder();
    let buffer = '';
    let resolvedModel = model;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (trimmed === 'data: [DONE]') {
            yield { type: 'done', model: resolvedModel };
            return;
          }
          if (!trimmed.startsWith('data: ')) continue;
          try {
            const chunk = JSON.parse(trimmed.slice(6));
            resolvedModel = chunk.model ?? resolvedModel;
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
              yield { type: 'token', text: delta };
            }
          } catch { /* skip malformed */ }
        }
      }
    } finally {
      reader.releaseLock();
    }
    yield { type: 'done', model: resolvedModel };
  }

  /** Quick connectivity test — GET /v1/models. */
  async testConnection(): Promise<{
    ok: boolean;
    models: string[];
    error?: string;
  }> {
    const apiKey = this.getApiKey();
    const baseUrl = this.getBaseUrl();
    if (!apiKey || !baseUrl) {
      return { ok: false, models: [], error: 'URL ou chave não configurada.' };
    }
    try {
      const url = `${openAiV1Base(baseUrl)}/models`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok)
        return {
          ok: false,
          models: [],
          error: `HTTP ${res.status}`,
        };
      const body = await res.json();
      const models = (body?.data ?? [])
        .map((m: any) => m?.id)
        .filter(Boolean) as string[];
      return { ok: true, models };
    } catch (e) {
      return {
        ok: false,
        models: [],
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}
