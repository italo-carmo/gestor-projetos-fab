import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { setLitellmDbOverrides } from '../llm/litellm.service';

export const AI_SETTING_KEYS = {
  systemPrompt: 'ai.systemPrompt',
  baseUrl: 'ai.litellm.baseUrl',
  apiKey: 'ai.litellm.apiKey',
  model: 'ai.litellm.model',
} as const;

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

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.syncLitellmOverrides();
  }

  private get appSetting() {
    return (this.prisma as any).appSetting;
  }

  async get(key: string): Promise<string | null> {
    const row = await this.appSetting.findUnique({ where: { key } });
    return (row as any)?.value ?? null;
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
  }> {
    const rows: { key: string; value: string }[] =
      await this.appSetting.findMany({
        where: { key: { in: Object.values(AI_SETTING_KEYS) } },
      });
    const map = new Map<string, string>(rows.map((r) => [r.key, r.value]));
    const apiKey: string = map.get(AI_SETTING_KEYS.apiKey) ?? '';
    return {
      systemPrompt: map.get(AI_SETTING_KEYS.systemPrompt) ?? DEFAULT_SYSTEM_PROMPT,
      baseUrl: map.get(AI_SETTING_KEYS.baseUrl) ?? '',
      apiKey,
      apiKeyMasked: apiKey
        ? `${apiKey.slice(0, 5)}${'*'.repeat(Math.max(0, apiKey.length - 5))}`
        : '',
      model: map.get(AI_SETTING_KEYS.model) ?? '',
    };
  }

  async updateAiSettings(
    patch: Partial<{
      systemPrompt: string;
      baseUrl: string;
      apiKey: string;
      model: string;
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
}
