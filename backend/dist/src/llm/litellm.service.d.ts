import { ConfigService } from '@nestjs/config';
export type ChatRole = 'system' | 'user' | 'assistant';
export type ChatMessage = {
    role: ChatRole;
    content: string;
};
export type ChatCompletionParams = {
    messages: ChatMessage[];
    model?: string;
    temperature?: number;
    max_tokens?: number;
};
export declare function stripEnvQuotes(value: string | undefined): string | undefined;
export declare function firstConfig(config: ConfigService, keys: string[]): string | undefined;
export declare const LITELLM_API_KEY_ENV_KEYS: readonly ["API_LITELLM", "LITELLM_API_KEY", "OPENAI_API_KEY"];
export declare const LITELLM_BASE_URL_ENV_KEYS: readonly ["API_LITELLM_BASE_URL", "LITELLM_BASE_URL", "OPENAI_BASE_URL"];
export declare const LITELLM_MODEL_ENV_KEYS: readonly ["API_LITELLM_MODEL", "LITELLM_MODEL", "OPENAI_MODEL"];
export declare const LITELLM_DEFAULT_GPT_OSS = "gpt-oss:20b";
export declare function normalizeLitellmModelId(raw: string, config: ConfigService): string;
export declare function stripReasoningPrefix(text: string): string;
declare let dbOverrides: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
};
export declare function setLitellmDbOverrides(o: typeof dbOverrides): void;
export declare class LitellmService {
    private readonly config;
    private readonly logger;
    constructor(config: ConfigService);
    isConfigured(): boolean;
    getBaseUrl(): string | undefined;
    getApiKey(): string | undefined;
    getDefaultModel(): string;
    private resolveModel;
    private buildHeaders;
    chatCompletion(params: ChatCompletionParams): Promise<{
        content: string;
        model: string;
    }>;
    chatCompletionStream(params: ChatCompletionParams): AsyncGenerator<{
        type: 'token';
        text: string;
    } | {
        type: 'done';
        model: string;
    }>;
    testConnection(): Promise<{
        ok: boolean;
        models: string[];
        error?: string;
    }>;
}
export {};
