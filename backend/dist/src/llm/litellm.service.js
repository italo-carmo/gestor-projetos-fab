"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var LitellmService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LitellmService = exports.LITELLM_DEFAULT_GPT_OSS = exports.LITELLM_MODEL_ENV_KEYS = exports.LITELLM_BASE_URL_ENV_KEYS = exports.LITELLM_API_KEY_ENV_KEYS = void 0;
exports.stripEnvQuotes = stripEnvQuotes;
exports.firstConfig = firstConfig;
exports.normalizeLitellmModelId = normalizeLitellmModelId;
exports.stripReasoningPrefix = stripReasoningPrefix;
exports.setLitellmDbOverrides = setLitellmDbOverrides;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
function stripEnvQuotes(value) {
    if (value == null)
        return undefined;
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
function openAiV1Base(baseUrl) {
    const u = baseUrl.trim().replace(/\/+$/, '');
    if (u.endsWith('/v1'))
        return u;
    return `${u}/v1`;
}
function firstConfig(config, keys) {
    for (const key of keys) {
        const fromEnv = stripEnvQuotes(process.env[key]);
        if (fromEnv)
            return fromEnv;
        const fromConfig = stripEnvQuotes(config.get(key));
        if (fromConfig)
            return fromConfig;
    }
    return undefined;
}
exports.LITELLM_API_KEY_ENV_KEYS = [
    'API_LITELLM',
    'LITELLM_API_KEY',
    'OPENAI_API_KEY',
];
exports.LITELLM_BASE_URL_ENV_KEYS = [
    'API_LITELLM_BASE_URL',
    'LITELLM_BASE_URL',
    'OPENAI_BASE_URL',
];
exports.LITELLM_MODEL_ENV_KEYS = [
    'API_LITELLM_MODEL',
    'LITELLM_MODEL',
    'OPENAI_MODEL',
];
exports.LITELLM_DEFAULT_GPT_OSS = 'gpt-oss:20b';
function normalizeLitellmModelId(raw, config) {
    let m = raw.trim();
    if (!m)
        return exports.LITELLM_DEFAULT_GPT_OSS;
    const low = m.toLowerCase().replace(/_/g, '-');
    if (low === 'gpt-oss-20b' || low === 'gptoss-20b') {
        m = exports.LITELLM_DEFAULT_GPT_OSS;
    }
    const styleFlag = firstConfig(config, [
        'API_LITELLM_OPENAI_STYLE_MODEL',
        'LITELLM_OPENAI_STYLE_MODEL',
    ]);
    const openAiStyle = styleFlag === '1' ||
        String(styleFlag ?? '').trim().toLowerCase() === 'true';
    const mLow = m.toLowerCase();
    if (openAiStyle &&
        !m.includes('/') &&
        mLow.startsWith('gpt-oss:') &&
        !mLow.startsWith('openai/')) {
        return `openai/${m.replace(/:/g, '-')}`;
    }
    return m;
}
const REASONING_MARKERS = ['assistantfinal', 'assistant_final', 'finalanswer', 'final_answer'];
const REASONING_PREAMBLE_PATTERN = /^(we need to|let'?s\b|must\b|now\b|first\b|second\b|third\b|i need to|i should|we should|we must|analysis\b|thinking\b|preciso\b|devemos\b|temos que\b|vou\b|vamos\b)/i;
function stripReasoningPrefix(text) {
    const original = text;
    let current = text;
    const lower = current.toLowerCase();
    for (const marker of REASONING_MARKERS) {
        const idx = lower.lastIndexOf(marker);
        if (idx !== -1) {
            current = current.slice(idx + marker.length).trimStart();
            return stripReasoningPreamble(current);
        }
    }
    if (lower.startsWith('analysis')) {
        current = current.slice(8).trimStart();
        return stripReasoningPreamble(current);
    }
    current = stripReasoningPreamble(current);
    return current || original;
}
function stripReasoningPreamble(text) {
    const source = text.trimStart();
    if (!source)
        return source;
    const headingMatch = source.match(/\n##?\s+/);
    if (headingMatch && typeof headingMatch.index === 'number' && headingMatch.index > 0) {
        const before = source.slice(0, headingMatch.index);
        if (REASONING_PREAMBLE_PATTERN.test(before.trim())) {
            return source.slice(headingMatch.index + 1).trimStart();
        }
    }
    const lines = source.split('\n');
    let idx = 0;
    while (idx < lines.length) {
        const line = lines[idx].trim();
        if (!line) {
            idx++;
            continue;
        }
        if (REASONING_PREAMBLE_PATTERN.test(line)) {
            idx++;
            continue;
        }
        if (/^[-*]\s+/.test(line) && REASONING_PREAMBLE_PATTERN.test(line.slice(2).trim())) {
            idx++;
            continue;
        }
        break;
    }
    const cleaned = lines.slice(idx).join('\n').trimStart();
    return cleaned || source;
}
function extractTextLike(value) {
    if (typeof value === 'string')
        return value;
    if (Array.isArray(value)) {
        return value.map((item) => extractTextLike(item)).join('');
    }
    if (value && typeof value === 'object') {
        const candidate = value;
        if (typeof candidate.text === 'string')
            return candidate.text;
        if (typeof candidate.content === 'string')
            return candidate.content;
    }
    return '';
}
let dbOverrides = {};
function setLitellmDbOverrides(o) {
    dbOverrides = { ...o };
}
let LitellmService = LitellmService_1 = class LitellmService {
    config;
    logger = new common_1.Logger(LitellmService_1.name);
    constructor(config) {
        this.config = config;
    }
    isConfigured() {
        return Boolean(this.getApiKey() && this.getBaseUrl());
    }
    getBaseUrl() {
        return (dbOverrides.baseUrl ||
            firstConfig(this.config, [...exports.LITELLM_BASE_URL_ENV_KEYS]));
    }
    getApiKey() {
        return (dbOverrides.apiKey ||
            firstConfig(this.config, [...exports.LITELLM_API_KEY_ENV_KEYS]));
    }
    getDefaultModel() {
        const raw = dbOverrides.model ||
            firstConfig(this.config, [...exports.LITELLM_MODEL_ENV_KEYS])?.trim() ||
            exports.LITELLM_DEFAULT_GPT_OSS;
        return normalizeLitellmModelId(raw, this.config);
    }
    resolveModel(explicit) {
        return explicit?.trim()
            ? normalizeLitellmModelId(explicit, this.config)
            : this.getDefaultModel();
    }
    buildHeaders(apiKey) {
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        };
    }
    async chatCompletion(params) {
        const apiKey = this.getApiKey();
        const baseUrl = this.getBaseUrl();
        if (!apiKey || !baseUrl) {
            throw new Error('LiteLLM não configurado. Configure via Administração > IA ou defina no .env.');
        }
        const model = this.resolveModel(params.model);
        const url = `${openAiV1Base(baseUrl)}/chat/completions`;
        const body = {
            model,
            messages: params.messages,
            temperature: params.temperature ?? 0.35,
            max_tokens: params.max_tokens ?? 2048,
        };
        let res;
        try {
            res = await fetch(url, {
                method: 'POST',
                headers: this.buildHeaders(apiKey),
                body: JSON.stringify(body),
            });
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.warn(`LiteLLM request failed: ${msg}`);
            throw new Error(`Falha de rede ao contatar LiteLLM: ${msg}`);
        }
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        }
        catch {
            this.logger.warn(`LiteLLM resposta não-JSON (${res.status}): ${text.slice(0, 500)}`);
            throw new Error(res.ok
                ? 'Resposta inválida do LiteLLM (não é JSON).'
                : `LiteLLM retornou HTTP ${res.status}.`);
        }
        if (!res.ok) {
            const errMsg = data.error?.message || text.slice(0, 800);
            this.logger.warn(`LiteLLM HTTP ${res.status}: ${errMsg}`);
            throw new Error(errMsg || `LiteLLM HTTP ${res.status}`);
        }
        const rawContent = data.choices?.[0]?.message?.content?.trim() ?? '';
        if (!rawContent) {
            throw new Error('LiteLLM não retornou conteúdo na resposta.');
        }
        const content = stripReasoningPrefix(rawContent);
        return { content, model: data.model ?? model };
    }
    async *chatCompletionStream(params) {
        const apiKey = this.getApiKey();
        const baseUrl = this.getBaseUrl();
        if (!apiKey || !baseUrl) {
            throw new Error('LiteLLM não configurado. Configure via Administração > IA ou defina no .env.');
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
        let res;
        try {
            res = await fetch(url, {
                method: 'POST',
                headers: this.buildHeaders(apiKey),
                body: JSON.stringify(body),
            });
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            throw new Error(`Falha de rede ao contatar LiteLLM: ${msg}`);
        }
        if (!res.ok) {
            const text = await res.text();
            let errMsg = text.slice(0, 800);
            try {
                const j = JSON.parse(text);
                errMsg = j?.error?.message || errMsg;
            }
            catch { }
            throw new Error(errMsg || `LiteLLM HTTP ${res.status}`);
        }
        const reader = res.body?.getReader();
        if (!reader)
            throw new Error('Sem body na resposta SSE do LiteLLM.');
        const decoder = new TextDecoder();
        let sseBuffer = '';
        let resolvedModel = model;
        let reasoningDone = false;
        let accumulated = '';
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                sseBuffer += decoder.decode(value, { stream: true });
                const lines = sseBuffer.split('\n');
                sseBuffer = lines.pop() ?? '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith(':'))
                        continue;
                    if (trimmed === 'data: [DONE]') {
                        if (!reasoningDone && accumulated) {
                            const cleaned = stripReasoningPrefix(accumulated);
                            if (cleaned)
                                yield { type: 'token', text: cleaned };
                        }
                        yield { type: 'done', model: resolvedModel };
                        return;
                    }
                    if (!trimmed.startsWith('data: '))
                        continue;
                    try {
                        const chunk = JSON.parse(trimmed.slice(6));
                        resolvedModel = chunk.model ?? resolvedModel;
                        const choice = chunk.choices?.[0];
                        const finishReason = choice?.finish_reason;
                        const delta = extractTextLike(choice?.delta?.content);
                        if (delta) {
                            if (reasoningDone) {
                                yield { type: 'token', text: delta };
                            }
                            else {
                                accumulated += delta;
                                const accLower = accumulated.toLowerCase();
                                for (const marker of REASONING_MARKERS) {
                                    const idx = accLower.lastIndexOf(marker);
                                    if (idx !== -1) {
                                        reasoningDone = true;
                                        const afterMarker = accumulated.slice(idx + marker.length);
                                        accumulated = '';
                                        const clean = afterMarker.trimStart();
                                        if (clean)
                                            yield { type: 'token', text: clean };
                                        break;
                                    }
                                }
                            }
                        }
                        if (finishReason) {
                            if (!reasoningDone && accumulated) {
                                const cleaned = stripReasoningPrefix(accumulated);
                                if (cleaned)
                                    yield { type: 'token', text: cleaned };
                            }
                            yield { type: 'done', model: resolvedModel };
                            return;
                        }
                    }
                    catch {
                    }
                }
            }
        }
        finally {
            reader.releaseLock();
        }
        if (!reasoningDone && accumulated) {
            const cleaned = stripReasoningPrefix(accumulated);
            if (cleaned)
                yield { type: 'token', text: cleaned };
        }
        yield { type: 'done', model: resolvedModel };
    }
    async testConnection() {
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
                .map((m) => m?.id)
                .filter(Boolean);
            return { ok: true, models };
        }
        catch (e) {
            return {
                ok: false,
                models: [],
                error: e instanceof Error ? e.message : String(e),
            };
        }
    }
};
exports.LitellmService = LitellmService;
exports.LitellmService = LitellmService = LitellmService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], LitellmService);
//# sourceMappingURL=litellm.service.js.map