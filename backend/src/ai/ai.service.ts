import { Injectable, Logger } from '@nestjs/common';
import { LitellmService, ChatMessage } from '../llm/litellm.service';
import { SettingsService } from '../settings/settings.service';
import { StrategicService } from '../strategic/strategic.service';

export type AnalysisType =
  | 'executive'
  | 'situational'
  | 'aggressor'
  | 'text'
  | 'geo';

export const ANALYSIS_CATALOG: {
  type: AnalysisType;
  title: string;
  description: string;
  icon: string;
}[] = [
  {
    type: 'executive',
    title: 'Resumo Executivo Completo',
    description:
      'Narrativa consolidada com dados situacionais, perfil de assédio, análise textual e distribuição geográfica.',
    icon: 'AutoAwesome',
  },
  {
    type: 'situational',
    title: 'Análise Situacional',
    description:
      'Panorama dos indicadores-chave: pesquisas, denúncias, atividades e missões.',
    icon: 'Dashboard',
  },
  {
    type: 'aggressor',
    title: 'Perfil de Assédio e Violência',
    description:
      'Análise detalhada do perfil do agressor, vítima, tipos de violência e relações hierárquicas.',
    icon: 'Fingerprint',
  },
  {
    type: 'text',
    title: 'Análise Textual',
    description:
      'Termos mais citados, padrões e tendências identificados nos textos livres do sistema.',
    icon: 'TextSnippet',
  },
  {
    type: 'geo',
    title: 'Distribuição Geográfica',
    description:
      'Concentração de ocorrências, atividades e missões por estado e localidade.',
    icon: 'Map',
  },
];

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly litellm: LitellmService,
    private readonly settings: SettingsService,
    private readonly strategic: StrategicService,
  ) {}

  getAnalysesCatalog() {
    return ANALYSIS_CATALOG;
  }

  async *analyzeStream(
    type: AnalysisType,
  ): AsyncGenerator<string> {
    yield this.sseEvent('progress', { percent: 5, stage: 'Coletando dados...' });

    const data = await this.gatherDataForType(type);

    yield this.sseEvent('progress', { percent: 25, stage: 'Preparando contexto...' });

    const systemPrompt = await this.settings.getSystemPrompt();
    const userPrompt = this.buildUserPrompt(type, data);

    yield this.sseEvent('progress', { percent: 30, stage: 'Enviando ao modelo...' });

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    let fullText = '';
    let tokenCount = 0;

    try {
      for await (const chunk of this.litellm.chatCompletionStream({
        messages,
        max_tokens: 3000,
      })) {
        if (chunk.type === 'token') {
          fullText += chunk.text;
          tokenCount++;
          const progress = Math.min(95, 30 + Math.floor((tokenCount / 300) * 65));
          yield this.sseEvent('token', { text: chunk.text, percent: progress });
        } else if (chunk.type === 'done') {
          yield this.sseEvent('done', {
            percent: 100,
            narrative: fullText,
            model: chunk.model,
            generatedAt: new Date().toISOString(),
          });
          return;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      yield this.sseEvent('error', { message: msg });
      return;
    }

    yield this.sseEvent('done', {
      percent: 100,
      narrative: fullText,
      model: 'unknown',
      generatedAt: new Date().toISOString(),
    });
  }

  async *chatStream(
    message: string,
    history: ChatMessage[],
  ): AsyncGenerator<string> {
    const systemPrompt = await this.settings.getSystemPrompt();

    let contextSummary: string;
    try {
      const dashboard = await this.strategic.situationalDashboard();
      const complaints = (dashboard as any).complaints ?? {};
      const surveys = (dashboard as any).surveys ?? {};
      contextSummary =
        `Dados do sistema (resumo compacto para contexto):\n` +
        `- Pesquisas: ${surveys.totalResponses ?? 0} respondentes, taxa de violência ${surveys.violenceRatePercent ?? 0}%\n` +
        `- Denúncias: ${complaints.totalCases ?? 0} total, ${complaints.openCases ?? 0} em aberto\n` +
        `- Atividades: ${(dashboard as any).activities?.totalActivities ?? 0}\n` +
        `- Missões: ${(dashboard as any).missions?.totalMissions ?? 0}\n` +
        `- Localidades: ${(dashboard as any).localityCount ?? 0}`;
    } catch {
      contextSummary = 'Dados do sistema indisponíveis no momento.';
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `${systemPrompt}\n\n${contextSummary}`,
      },
      ...history.slice(-20),
      { role: 'user', content: message },
    ];

    try {
      for await (const chunk of this.litellm.chatCompletionStream({
        messages,
        max_tokens: 2048,
      })) {
        if (chunk.type === 'token') {
          yield this.sseEvent('token', { text: chunk.text });
        } else if (chunk.type === 'done') {
          yield this.sseEvent('done', { model: chunk.model });
          return;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      yield this.sseEvent('error', { message: msg });
    }
  }

  private sseEvent(event: string, data: any): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  }

  private async gatherDataForType(type: AnalysisType): Promise<any> {
    switch (type) {
      case 'executive': {
        const [dashboard, profile, text, geo] = await Promise.all([
          this.strategic.situationalDashboard(),
          this.strategic.aggressorProfile(),
          this.strategic.textAnalysis(),
          this.strategic.geoMap(),
        ]);
        return { dashboard, profile, textSummary: this.compactText(text), geoSummary: this.compactGeo(geo) };
      }
      case 'situational':
        return { dashboard: await this.strategic.situationalDashboard() };
      case 'aggressor':
        return { profile: await this.strategic.aggressorProfile() };
      case 'text':
        return { textAnalysis: await this.strategic.textAnalysis() };
      case 'geo':
        return { geoMap: await this.strategic.geoMap() };
      default:
        return {};
    }
  }

  private buildUserPrompt(type: AnalysisType, data: any): string {
    let payloadJson = JSON.stringify(data);
    if (payloadJson.length > 28_000) {
      payloadJson = payloadJson.slice(0, 28_000) + '\n…(dados truncados)';
    }

    const typeDescriptions: Record<AnalysisType, string> = {
      executive:
        'Redija um resumo executivo completo para o comando, abordando panorama situacional, perfil de denúncias, destaques textuais e distribuição geográfica.',
      situational:
        'Analise o panorama situacional: pesquisas, taxas de violência, denúncias ativas, atividades e missões.',
      aggressor:
        'Analise o perfil de assédio e violência: tipos de ocorrência, perfil do agressor e da vítima, relações hierárquicas e contextos.',
      text:
        'Analise os padrões e tendências identificados nos textos livres do sistema: termos mais frequentes, temas recorrentes e insights.',
      geo:
        'Analise a distribuição geográfica: estados com mais registros, concentração de denúncias, atividades e missões por região.',
    };

    return `${typeDescriptions[type]}\n\nDados JSON:\n${payloadJson}`;
  }

  private compactText(text: any) {
    return {
      totalTexts: text?.consolidated?.totalTexts ?? 0,
      topWords: (text?.consolidated?.topWords ?? []).slice(0, 30),
    };
  }

  private compactGeo(geo: any) {
    return {
      statesSample: (geo?.states ?? []).slice(0, 12).map((s: any) => ({
        uf: s.uf,
        complaints: s.complaints,
        activities: s.activities,
        missions: s.missions,
      })),
      totalLocalitiesWithUf: geo?.totalLocalitiesWithUf,
    };
  }
}
