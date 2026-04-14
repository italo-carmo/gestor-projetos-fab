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
var SettingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsService = exports.DEFAULT_SYSTEM_PROMPT = exports.ANALYSIS_PROMPT_KEYS = exports.AI_SETTING_KEYS = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const litellm_service_1 = require("../llm/litellm.service");
exports.AI_SETTING_KEYS = {
    systemPrompt: 'ai.systemPrompt',
    baseUrl: 'ai.litellm.baseUrl',
    apiKey: 'ai.litellm.apiKey',
    model: 'ai.litellm.model',
};
exports.ANALYSIS_PROMPT_KEYS = {
    executive: 'ai.prompt.executive',
    situational: 'ai.prompt.situational',
    aggressor: 'ai.prompt.aggressor',
    text: 'ai.prompt.text',
    geo: 'ai.prompt.geo',
};
exports.DEFAULT_SYSTEM_PROMPT = `Você é um analista institucional da Força Aérea Brasileira (FAB), especializado no programa CIPAVD/SMIF de prevenção e combate ao assédio e violência doméstica.

REGRAS OBRIGATÓRIAS:
1. Responda EXCLUSIVAMENTE em português do Brasil. NUNCA use inglês, nem uma palavra sequer.
2. Baseie-se SOMENTE nos dados fornecidos no contexto JSON. Não invente números.
3. Use tom técnico, objetivo e institucional.
4. Estruture respostas em parágrafos curtos e claros.
5. Ao citar estatísticas, inclua o número absoluto e, quando disponível, o percentual.
6. Use formatação Markdown para organizar a resposta: títulos (##), **negrito**, listas, tabelas quando apropriado. Isso melhora a legibilidade.
7. NUNCA mostre seu raciocínio interno, cálculos auxiliares, rascunhos ou pensamentos. Entregue APENAS a análise final pronta.
8. NÃO repita a pergunta ou as instruções. Vá direto à análise.`;
let SettingsService = SettingsService_1 = class SettingsService {
    prisma;
    logger = new common_1.Logger(SettingsService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async onModuleInit() {
        await this.syncLitellmOverrides();
    }
    get appSetting() {
        return this.prisma.appSetting;
    }
    async get(key) {
        const row = await this.appSetting.findUnique({ where: { key } });
        return row?.value ?? null;
    }
    async set(key, value) {
        await this.appSetting.upsert({
            where: { key },
            update: { value },
            create: { key, value },
        });
    }
    async getAiSettings() {
        const allKeys = [
            ...Object.values(exports.AI_SETTING_KEYS),
            ...Object.values(exports.ANALYSIS_PROMPT_KEYS),
        ];
        const rows = await this.appSetting.findMany({
            where: { key: { in: allKeys } },
        });
        const map = new Map(rows.map((r) => [r.key, r.value]));
        const apiKey = map.get(exports.AI_SETTING_KEYS.apiKey) ?? '';
        const analysisPrompts = {};
        for (const [type, key] of Object.entries(exports.ANALYSIS_PROMPT_KEYS)) {
            analysisPrompts[type] = map.get(key) ?? '';
        }
        return {
            systemPrompt: map.get(exports.AI_SETTING_KEYS.systemPrompt) ?? exports.DEFAULT_SYSTEM_PROMPT,
            baseUrl: map.get(exports.AI_SETTING_KEYS.baseUrl) ?? '',
            apiKey,
            apiKeyMasked: apiKey
                ? `${apiKey.slice(0, 5)}${'*'.repeat(Math.max(0, apiKey.length - 5))}`
                : '',
            model: map.get(exports.AI_SETTING_KEYS.model) ?? '',
            analysisPrompts,
        };
    }
    async updateAiSettings(patch) {
        const ops = [];
        if (patch.systemPrompt !== undefined) {
            ops.push(this.set(exports.AI_SETTING_KEYS.systemPrompt, patch.systemPrompt));
        }
        if (patch.baseUrl !== undefined) {
            ops.push(this.set(exports.AI_SETTING_KEYS.baseUrl, patch.baseUrl));
        }
        if (patch.apiKey !== undefined) {
            ops.push(this.set(exports.AI_SETTING_KEYS.apiKey, patch.apiKey));
        }
        if (patch.model !== undefined) {
            ops.push(this.set(exports.AI_SETTING_KEYS.model, patch.model));
        }
        if (patch.analysisPrompts) {
            for (const [type, value] of Object.entries(patch.analysisPrompts)) {
                const key = exports.ANALYSIS_PROMPT_KEYS[type];
                if (key)
                    ops.push(this.set(key, value));
            }
        }
        await Promise.all(ops);
        await this.syncLitellmOverrides();
    }
    async syncLitellmOverrides() {
        try {
            const settings = await this.getAiSettings();
            (0, litellm_service_1.setLitellmDbOverrides)({
                apiKey: settings.apiKey || undefined,
                baseUrl: settings.baseUrl || undefined,
                model: settings.model || undefined,
            });
            this.logger.log('LiteLLM DB overrides sincronizados.');
        }
        catch (e) {
            this.logger.warn(`Falha ao sincronizar overrides: ${e}`);
        }
    }
    async getSystemPrompt() {
        const val = await this.get(exports.AI_SETTING_KEYS.systemPrompt);
        return val || exports.DEFAULT_SYSTEM_PROMPT;
    }
    async getAnalysisPrompt(type) {
        const key = exports.ANALYSIS_PROMPT_KEYS[type];
        if (!key)
            return null;
        const val = await this.get(key);
        return val || null;
    }
};
exports.SettingsService = SettingsService;
exports.SettingsService = SettingsService = SettingsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SettingsService);
//# sourceMappingURL=settings.service.js.map