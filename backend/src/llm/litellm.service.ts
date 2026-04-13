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

function stripEnvQuotes(value: string | undefined): string | undefined {
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

/**
 * Lê variáveis do LiteLLM: primeiro `process.env` (systemd EnvironmentFile),
 * depois ConfigService. Evita falha se o cache interno do Config divergir do ambiente.
 */
function firstConfig(
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

/** Chaves aceitas (ordem de prioridade). */
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

@Injectable()
export class LitellmService {
  private readonly logger = new Logger(LitellmService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.getApiKey() && this.getBaseUrl());
  }

  getBaseUrl(): string | undefined {
    return firstConfig(this.config, [...LITELLM_BASE_URL_ENV_KEYS]);
  }

  getApiKey(): string | undefined {
    return firstConfig(this.config, [...LITELLM_API_KEY_ENV_KEYS]);
  }

  /** Padrão alinhado ao deployment LiteLLM interno (gpt-oss-20b). Sobrescreva com API_LITELLM_MODEL. */
  getDefaultModel(): string {
    return (
      firstConfig(this.config, [...LITELLM_MODEL_ENV_KEYS])?.trim() ||
      'gpt-oss-20b'
    );
  }

  /**
   * OpenAI-compatible chat completions via LiteLLM proxy (same pattern as
   * ChatOpenAI(base_url=..., api_key=...) no projeto Python).
   */
  async chatCompletion(
    params: ChatCompletionParams,
  ): Promise<{ content: string; model: string }> {
    const apiKey = this.getApiKey();
    const baseUrl = this.getBaseUrl();
    if (!apiKey || !baseUrl) {
      throw new Error(
        `LiteLLM não configurado: defina chave (${LITELLM_API_KEY_ENV_KEYS.join(' ou ')}) e base URL (${LITELLM_BASE_URL_ENV_KEYS.join(' ou ')}) no .env do backend.`,
      );
    }

    const model = params.model?.trim() || this.getDefaultModel();
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
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
      this.logger.warn(`LiteLLM resposta não-JSON (${res.status}): ${text.slice(0, 500)}`);
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
}
