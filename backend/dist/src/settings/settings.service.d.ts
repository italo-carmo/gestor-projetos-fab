import { OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
export declare const AI_SETTING_KEYS: {
    readonly systemPrompt: "ai.systemPrompt";
    readonly baseUrl: "ai.litellm.baseUrl";
    readonly apiKey: "ai.litellm.apiKey";
    readonly model: "ai.litellm.model";
};
export declare const ANALYSIS_PROMPT_KEYS: Record<string, string>;
export declare const DEFAULT_SYSTEM_PROMPT = "Voc\u00EA \u00E9 um analista institucional da For\u00E7a A\u00E9rea Brasileira (FAB), especializado no programa CIPAVD/SMIF de preven\u00E7\u00E3o e combate ao ass\u00E9dio e viol\u00EAncia dom\u00E9stica.\n\nREGRAS OBRIGAT\u00D3RIAS:\n1. Responda EXCLUSIVAMENTE em portugu\u00EAs do Brasil. NUNCA use ingl\u00EAs, nem uma palavra sequer.\n2. Baseie-se SOMENTE nos dados fornecidos no contexto JSON. N\u00E3o invente n\u00FAmeros.\n3. Use tom t\u00E9cnico, objetivo e institucional.\n4. Estruture respostas em par\u00E1grafos curtos e claros.\n5. Ao citar estat\u00EDsticas, inclua o n\u00FAmero absoluto e, quando dispon\u00EDvel, o percentual.\n6. Use formata\u00E7\u00E3o Markdown para organizar a resposta: t\u00EDtulos (##), **negrito**, listas, tabelas quando apropriado. Isso melhora a legibilidade.\n7. NUNCA mostre seu racioc\u00EDnio interno, c\u00E1lculos auxiliares, rascunhos ou pensamentos. Entregue APENAS a an\u00E1lise final pronta.\n8. N\u00C3O repita a pergunta ou as instru\u00E7\u00F5es. V\u00E1 direto \u00E0 an\u00E1lise.";
export declare class SettingsService implements OnModuleInit {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    onModuleInit(): Promise<void>;
    private get appSetting();
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    getAiSettings(): Promise<{
        systemPrompt: string;
        baseUrl: string;
        apiKey: string;
        apiKeyMasked: string;
        model: string;
        analysisPrompts: Record<string, string>;
    }>;
    updateAiSettings(patch: Partial<{
        systemPrompt: string;
        baseUrl: string;
        apiKey: string;
        model: string;
        analysisPrompts: Record<string, string>;
    }>): Promise<void>;
    syncLitellmOverrides(): Promise<void>;
    getSystemPrompt(): Promise<string>;
    getAnalysisPrompt(type: string): Promise<string | null>;
}
