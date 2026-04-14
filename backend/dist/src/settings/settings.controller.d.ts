import { SettingsService } from './settings.service';
import { LitellmService } from '../llm/litellm.service';
export declare class SettingsController {
    private readonly settings;
    private readonly litellm;
    constructor(settings: SettingsService, litellm: LitellmService);
    getAiSettings(): Promise<{
        systemPrompt: string;
        baseUrl: string;
        apiKey: string;
        apiKeyMasked: string;
        model: string;
        analysisPrompts: Record<string, string>;
    }>;
    updateAiSettings(body: {
        systemPrompt?: string;
        baseUrl?: string;
        apiKey?: string;
        model?: string;
        analysisPrompts?: Record<string, string>;
    }): Promise<{
        ok: boolean;
    }>;
    testLitellmConnection(): Promise<{
        ok: boolean;
        models: string[];
        error?: string;
    }>;
}
