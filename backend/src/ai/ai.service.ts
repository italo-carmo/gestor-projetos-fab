import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LitellmService, ChatMessage } from '../llm/litellm.service';
import {
  type AiAnalysisType,
  ALL_KNOWLEDGE_SOURCE_IDS,
  type AiKnowledgeSourceId,
} from './ai-knowledge-sources';
import { SettingsService } from '../settings/settings.service';
import {
  StrategicService,
  AiSourceReference,
} from '../strategic/strategic.service';
import PDFDocument from 'pdfkit';

export type AnalysisType =
  | 'executive'
  | 'situational'
  | 'aggressor'
  | 'text'
  | 'geo';

export type ActionAgentType =
  | 'briefing_comgep'
  | 'priorizacao_intervencao'
  | 'governanca_cpca';

export type ComgepCopilotMode = 'executive' | 'analyst';

export type ComgepCopilotFocus = {
  kind:
    | 'overview'
    | 'kpi_covered_oms'
    | 'kpi_critical_ufs'
    | 'kpi_high_risk_oms'
    | 'kpi_operational_presence'
    | 'uf'
    | 'om'
    | 'coverage_gap'
    | 'operational_pressure';
  label?: string;
  description?: string;
  uf?: string | null;
  omId?: string | null;
  refId?: string | null;
};

type ComgepCopilotEvidenceItem = {
  id: string;
  type: 'om';
  omId: string | null;
  omCode: string;
  omName: string;
  title: string;
  uf: string;
  score: number;
  reason: string;
  link: string;
  source: string;
  coverageType?: string | null;
};

type ComgepCopilotMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  mode: ComgepCopilotMode;
  focus: ComgepCopilotFocus | null;
  evidences: ComgepCopilotEvidenceItem[];
  agentType: ActionAgentType;
};

type ComgepCopilotSession = {
  id: string;
  createdAt: string;
  updatedAt: string;
  agentType: ActionAgentType;
  scopeUf: string | null;
  mode: ComgepCopilotMode;
  focus: ComgepCopilotFocus | null;
  messages: ComgepCopilotMessage[];
};

type ComgepCopilotStreamParams = {
  agentType: ActionAgentType;
  room: any;
  scopeUf: string | null;
  mode: ComgepCopilotMode;
  focus: ComgepCopilotFocus | null;
  evidences: ComgepCopilotEvidenceItem[];
  history: ComgepCopilotMessage[];
  userMessage: string;
};

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

export const ACTION_AGENT_CATALOG: {
  type: ActionAgentType;
  title: string;
  description: string;
  icon: string;
}[] = [
  {
    type: 'briefing_comgep',
    title: 'Briefing COMGEP',
    description:
      'Consolida a sala de situação em um briefing executivo com riscos, decisões e ações imediatas.',
    icon: 'Campaign',
  },
  {
    type: 'priorizacao_intervencao',
    title: 'Priorização de Intervenção',
    description:
      'Ordena UFs e OMs prioritárias e propõe pacote de intervenção com justificativa objetiva.',
    icon: 'AssignmentTurnedIn',
  },
  {
    type: 'governanca_cpca',
    title: 'Governança CPCA',
    description:
      'Analisa cobertura, carga e gargalos da CPCA e propõe ajustes de governança e proteção.',
    icon: 'Shield',
  },
];

type NarrativePdfBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: number; text: string }
  | { type: 'table'; header: string[]; rows: string[][] };

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly streamIdleTimeoutMs = 90_000;
  private readonly comgepSessionTtlMs = 4 * 60 * 60 * 1000;
  private readonly comgepSessions = new Map<string, ComgepCopilotSession>();

  constructor(
    private readonly litellm: LitellmService,
    private readonly settings: SettingsService,
    private readonly strategic: StrategicService,
  ) {}

  private async resolveAnalysisSources(
    type: AnalysisType,
  ): Promise<AiKnowledgeSourceId[]> {
    try {
      return await this.settings.getAnalysisSourcesForType(
        type as AiAnalysisType,
      );
    } catch {
      return [...ALL_KNOWLEDGE_SOURCE_IDS];
    }
  }

  getAnalysesCatalog() {
    return ANALYSIS_CATALOG;
  }

  getActionAgentsCatalog() {
    return ACTION_AGENT_CATALOG;
  }

  async *runActionAgentStream(
    type: ActionAgentType,
    options?: {
      uf?: string | null;
      mode?: ComgepCopilotMode | null;
      focus?: Partial<ComgepCopilotFocus> | null;
    },
  ): AsyncGenerator<string> {
    const safeType = this.normalizeActionAgentType(type);
    const scopeUf = String(options?.uf ?? '').trim().toUpperCase() || null;
    const mode = this.normalizeComgepMode(options?.mode);
    const focus = this.normalizeComgepFocus(options?.focus, scopeUf);

    this.pruneComgepSessions();

    yield this.sseEvent('progress', {
      percent: 5,
      stage: 'Coletando dados da sala de situação...',
    });

    const room = await this.strategic.comgepSituationRoom();
    const initialUserMessage = this.buildInitialComgepUserMessage(
      safeType,
      mode,
      focus,
      scopeUf,
    );
    const session = this.createComgepSession({
      agentType: safeType,
      scopeUf,
      mode,
      focus,
    });
    this.pushComgepMessage(session, {
      role: 'user',
      content: initialUserMessage,
      mode,
      focus,
      evidences: [],
    });

    yield this.sseEvent('progress', {
      percent: 18,
      stage: 'Selecionando evidências e foco atual...',
    });

    const evidences = this.selectComgepEvidences({
      room,
      scopeUf,
      focus,
      agentType: safeType,
    });

    yield this.sseEvent('progress', {
      percent: 24,
      stage: 'Preparando contexto conversacional...',
    });

    try {
      const completion = this.streamComgepAssistantCompletion({
        agentType: safeType,
        room,
        scopeUf,
        mode,
        focus,
        evidences,
        history: session.messages,
        userMessage: initialUserMessage,
      });

      let finalResult: { narrative: string; model: string } | undefined;
      while (true) {
        const next = await completion.next();
        if (next.done) {
          finalResult = next.value;
          break;
        }
        yield next.value;
      }

      if (!finalResult || !String(finalResult.narrative ?? '').trim()) {
        throw new Error('O modelo encerrou a execução sem retorno final.');
      }

      const assistantMessage = this.pushComgepMessage(session, {
        role: 'assistant',
        content: finalResult.narrative,
        mode,
        focus,
        evidences,
      });
      const latestEvidenceLinks = this.extractEvidenceLinks(evidences);

      yield this.sseEvent('done', {
        percent: 100,
        narrative: finalResult.narrative,
        model: finalResult.model,
        generatedAt: assistantMessage.createdAt,
        scopeUf,
        sessionId: session.id,
        messageId: assistantMessage.id,
        mode,
        focus,
        evidences,
        evidenceLinks: latestEvidenceLinks,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      yield this.sseEvent('error', { message: msg });
    }
  }

  async *followUpActionAgentStream(args: {
    sessionId: string;
    message: string;
    mode?: ComgepCopilotMode | null;
    focus?: Partial<ComgepCopilotFocus> | null;
  }): AsyncGenerator<string> {
    const session = this.getComgepSessionOrThrow(args.sessionId);
    const message = String(args.message ?? '').trim();
    if (!message) {
      yield this.sseEvent('error', {
        message: 'Escreva uma pergunta para continuar a sessão.',
      });
      return;
    }

    const mode = this.normalizeComgepMode(args.mode ?? session.mode);
    const scopeUf = session.scopeUf;
    const focus = this.normalizeComgepFocus(args.focus, scopeUf) ?? session.focus;

    session.mode = mode;
    session.focus = focus;
    session.updatedAt = new Date().toISOString();

    yield this.sseEvent('progress', {
      percent: 5,
      stage: 'Atualizando o contexto da sessão...',
    });

    const room = await this.strategic.comgepSituationRoom();
    const userMessage = this.pushComgepMessage(session, {
      role: 'user',
      content: message,
      mode,
      focus,
      evidences: [],
    });

    yield this.sseEvent('progress', {
      percent: 18,
      stage: 'Reavaliando foco e evidências...',
    });

    const evidences = this.selectComgepEvidences({
      room,
      scopeUf,
      focus,
      agentType: session.agentType,
    });

    try {
      const completion = this.streamComgepAssistantCompletion({
        agentType: session.agentType,
        room,
        scopeUf,
        mode,
        focus,
        evidences,
        history: session.messages,
        userMessage: userMessage.content,
      });

      let finalResult: { narrative: string; model: string } | undefined;
      while (true) {
        const next = await completion.next();
        if (next.done) {
          finalResult = next.value;
          break;
        }
        yield next.value;
      }

      if (!finalResult || !String(finalResult.narrative ?? '').trim()) {
        throw new Error('O modelo encerrou a execução sem retorno final.');
      }

      const assistantMessage = this.pushComgepMessage(session, {
        role: 'assistant',
        content: finalResult.narrative,
        mode,
        focus,
        evidences,
      });

      yield this.sseEvent('done', {
        percent: 100,
        narrative: finalResult.narrative,
        model: finalResult.model,
        generatedAt: assistantMessage.createdAt,
        scopeUf,
        sessionId: session.id,
        messageId: assistantMessage.id,
        mode,
        focus,
        evidences,
        evidenceLinks: this.extractEvidenceLinks(evidences),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      yield this.sseEvent('error', { message: msg });
    }
  }

  async actionAgentSessionPdf(sessionId: string): Promise<Buffer> {
    const session = this.getComgepSessionOrThrow(sessionId);
    return this.renderComgepSessionPdf(session);
  }

  async analysisPdf(
    type: AnalysisType,
    options?: {
      narrative?: string;
      model?: string;
      generatedAt?: string;
    },
  ): Promise<Buffer> {
    const safeType: AnalysisType = ANALYSIS_CATALOG.some(
      (item) => item.type === type,
    )
      ? type
      : 'executive';
    const sources = await this.resolveAnalysisSources(safeType);
    const data = await this.gatherDataForType(safeType, sources);
    const narrativeBase = options?.narrative?.trim() ?? '';
    const narrative = await this.appendTraceabilityReferences(
      safeType,
      narrativeBase,
      sources,
    );
    const model = options?.model?.trim() || 'modelo não informado';
    const generatedAt = options?.generatedAt || new Date().toISOString();
    return this.renderAnalysisPdf({
      type: safeType,
      data,
      narrative,
      model,
      generatedAt,
    });
  }

  async *analyzeStream(type: AnalysisType): AsyncGenerator<string> {
    yield this.sseEvent('progress', {
      percent: 5,
      stage: 'Coletando dados...',
    });

    const sources = await this.resolveAnalysisSources(type);
    const data = await this.gatherDataForType(type, sources);

    yield this.sseEvent('progress', {
      percent: 25,
      stage: 'Preparando contexto...',
    });

    const systemPrompt = await this.settings.getSystemPrompt();
    const customPrompt = await this.settings.getAnalysisPrompt(type);
    const userPrompt = this.buildUserPrompt(type, data, customPrompt);

    yield this.sseEvent('progress', {
      percent: 30,
      stage: 'Enviando ao modelo...',
    });

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const configuredModel = this.litellm.getDefaultModel();
    let fullText = '';
    let tokenCount = 0;
    type StreamChunk =
      | { type: 'token'; text: string }
      | { type: 'done'; model: string };
    const iterator = this.litellm
      .chatCompletionStream({
        messages,
        max_tokens: 3000,
      })
      [Symbol.asyncIterator]();

    try {
      while (true) {
        let timeoutHandle: NodeJS.Timeout | undefined;
        let next: IteratorResult<StreamChunk>;
        try {
          next = (await Promise.race([
            iterator.next(),
            new Promise<IteratorResult<StreamChunk>>((_, reject) => {
              timeoutHandle = setTimeout(() => {
                reject(new Error('LITELLM_STREAM_IDLE_TIMEOUT'));
              }, this.streamIdleTimeoutMs);
            }),
          ])) as IteratorResult<StreamChunk>;
        } finally {
          if (timeoutHandle) clearTimeout(timeoutHandle);
        }
        if (next.done) break;

        const chunk = next.value;
        if (chunk.type === 'token') {
          fullText += chunk.text;
          tokenCount++;
          const progress = Math.min(
            95,
            30 + Math.floor((tokenCount / 300) * 65),
          );
          yield this.sseEvent('token', { text: chunk.text, percent: progress });
        } else if (chunk.type === 'done') {
          const narrativeWithRefs = await this.appendTraceabilityReferences(
            type,
            fullText,
            sources,
          );
          yield this.sseEvent('done', {
            percent: 100,
            narrative: narrativeWithRefs,
            model: chunk.model,
            generatedAt: new Date().toISOString(),
          });
          return;
        }
      }
    } catch (e) {
      let msg = e instanceof Error ? e.message : String(e);
      if (msg === 'LITELLM_STREAM_IDLE_TIMEOUT') {
        msg =
          `Sem resposta do modelo por ${Math.round(this.streamIdleTimeoutMs / 1000)}s ` +
          `(modelo configurado: ${configuredModel}). Verifique se o ID existe no LiteLLM e está disponível.`;
      }
      yield this.sseEvent('error', { message: msg });
      return;
    }

    const narrativeWithRefs = await this.appendTraceabilityReferences(
      type,
      fullText,
      sources,
    );
    yield this.sseEvent('done', {
      percent: 100,
      narrative: narrativeWithRefs,
      model: 'unknown',
      generatedAt: new Date().toISOString(),
    });
  }

  async *chatStream(
    message: string,
    history: ChatMessage[],
    analysisType?: AnalysisType,
  ): AsyncGenerator<string> {
    const systemPrompt = await this.settings.getSystemPrompt();
    const analysisSources = analysisType
      ? await this.resolveAnalysisSources(analysisType)
      : undefined;

    let contextSummary: string;
    try {
      const dashboard = analysisType
        ? await this.strategic.situationalDashboard({
            sources: analysisSources,
          })
        : await this.strategic.situationalDashboard();
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

  private async renderAnalysisPdf(args: {
    type: AnalysisType;
    data: any;
    narrative: string;
    model: string;
    generatedAt: string;
  }): Promise<Buffer> {
    const catalog = ANALYSIS_CATALOG.find((item) => item.type === args.type);
    const title = catalog?.title ?? 'Análise IA';

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 44,
        bufferPages: true,
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const BLUE = '#1A3C6E';
      const BLUE_LIGHT = '#2E5A9E';
      const RED = '#C62828';
      const GREEN = '#2E7D32';
      const ORANGE = '#E65100';
      const DARK = '#1E1E1E';
      const GRAY = '#6B7280';
      const BG = '#F5F7FA';
      const BORDER = '#D6DEE8';

      const LEFT = 44;
      const PAGE_WIDTH = doc.page.width - LEFT * 2;

      const ensureSpace = (needed: number) => {
        if (doc.y + needed > doc.page.height - 46) {
          doc.addPage();
        }
      };

      const sectionHeader = (num: string, text: string, color = BLUE) => {
        ensureSpace(36);
        doc.roundedRect(LEFT, doc.y, PAGE_WIDTH, 24, 4).fill(color);
        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor('#FFFFFF')
          .text(`${num} ${text}`, LEFT + 10, doc.y + 7, {
            width: PAGE_WIDTH - 20,
          });
        doc.y += 30;
      };

      const valueCard = (
        x: number,
        y: number,
        width: number,
        value: string,
        label: string,
        color: string,
      ) => {
        doc
          .roundedRect(x, y, width, 56, 5)
          .fill(BG)
          .strokeColor(BORDER)
          .lineWidth(0.5)
          .stroke();
        doc.roundedRect(x, y, 5, 56, 2).fill(color);
        doc
          .font('Helvetica-Bold')
          .fontSize(18)
          .fillColor(color)
          .text(value, x + 10, y + 10, { width: width - 20, align: 'center' });
        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor(GRAY)
          .text(label, x + 8, y + 34, { width: width - 16, align: 'center' });
      };

      const progressRow = (
        label: string,
        value: number,
        color: string,
        suffix = '%',
      ) => {
        ensureSpace(18);
        const safe = Number.isFinite(value)
          ? Math.max(0, Math.min(100, value))
          : 0;
        const y = doc.y;
        const barX = LEFT + PAGE_WIDTH * 0.58;
        const barW = PAGE_WIDTH * 0.3;
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(DARK)
          .text(label, LEFT, y, { width: PAGE_WIDTH * 0.56 });
        doc.roundedRect(barX, y + 1, barW, 8, 4).fill('#E5E7EB');
        doc.roundedRect(barX, y + 1, (safe / 100) * barW, 8, 4).fill(color);
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor(color)
          .text(
            `${safe.toFixed(1).replace('.', ',')}${suffix}`,
            barX + barW + 6,
            y,
            {
              width: 52,
            },
          );
        doc.y += 16;
      };

      const rankingRow = (
        index: number,
        label: string,
        count: number,
        maxCount: number,
        color: string,
      ) => {
        ensureSpace(15);
        const y = doc.y;
        const barX = LEFT + PAGE_WIDTH * 0.56;
        const barW = PAGE_WIDTH * 0.3;
        const fillW = maxCount > 0 ? Math.max(3, (count / maxCount) * barW) : 3;
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(DARK)
          .text(`${index + 1}. ${label}`, LEFT, y, {
            width: PAGE_WIDTH * 0.54,
          });
        doc.roundedRect(barX, y + 1, barW, 8, 4).fill('#E5E7EB');
        doc.roundedRect(barX, y + 1, fillW, 8, 4).fill(color);
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor(color)
          .text(String(count), barX + barW + 8, y, {
            width: 34,
          });
        doc.y += 14;
      };

      const drawNarrative = () => {
        sectionHeader('01', 'SÍNTESE NARRATIVA DA IA');
        const blocks = this.parseNarrativeBlocksForPdf(args.narrative);
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(GRAY)
          .text(
            'Texto gerado pela IA para apoio à tomada de decisão. Esta seção preserva a narrativa completa.',
            LEFT,
            doc.y,
            { width: PAGE_WIDTH },
          );
        doc.moveDown(0.4);
        const drawNarrativeTable = (table: {
          header: string[];
          rows: string[][];
        }) => {
          const colCount = Math.max(
            table.header.length,
            ...table.rows.map((row) => row.length),
          );
          if (colCount < 2) return;
          const colW = PAGE_WIDTH / colCount;
          const colWidths = Array.from({ length: colCount }, () => colW);
          const padX = 5;
          const padY = 4;
          const minRowHeight = 18;
          const pageBottom = doc.page.height - 46;

          const normalizeRow = (row: string[]) => {
            const out = [...row];
            while (out.length < colCount) out.push('');
            return out.slice(0, colCount);
          };

          const headerCells = normalizeRow(table.header);
          const bodyRows = table.rows.map((row) => normalizeRow(row));

          const computeRowHeight = (
            cells: string[],
            font: 'Helvetica' | 'Helvetica-Bold',
            size: number,
          ) => {
            let maxHeight = minRowHeight;
            for (let i = 0; i < colCount; i++) {
              const cell = cells[i] || ' ';
              const textHeight =
                doc
                  .font(font)
                  .fontSize(size)
                  .heightOfString(cell, {
                    width: colWidths[i] - padX * 2,
                    align: 'left',
                  }) +
                padY * 2;
              if (textHeight > maxHeight) maxHeight = textHeight;
            }
            return maxHeight;
          };

          const drawHeaderAt = (y: number) => {
            const rowH = computeRowHeight(headerCells, 'Helvetica-Bold', 8);
            doc.rect(LEFT, y, PAGE_WIDTH, rowH).fill(BLUE);
            let x = LEFT;
            for (let i = 0; i < colCount; i++) {
              doc
                .rect(x, y, colWidths[i], rowH)
                .lineWidth(0.35)
                .strokeColor(BORDER)
                .stroke();
              doc
                .font('Helvetica-Bold')
                .fontSize(8)
                .fillColor('#FFFFFF')
                .text(headerCells[i] || '', x + padX, y + padY, {
                  width: colWidths[i] - padX * 2,
                  align: 'left',
                });
              x += colWidths[i];
            }
            return y + rowH;
          };

          let y = doc.y;
          if (y + minRowHeight > pageBottom) {
            doc.addPage();
            y = doc.y;
          }
          y = drawHeaderAt(y);

          for (const [idx, row] of bodyRows.entries()) {
            const rowH = computeRowHeight(row, 'Helvetica', 8);
            if (y + rowH > pageBottom) {
              doc.addPage();
              y = drawHeaderAt(doc.y);
            }

            if (idx % 2 === 0) {
              doc.rect(LEFT, y, PAGE_WIDTH, rowH).fill('#F8FAFC');
            }

            let x = LEFT;
            for (let i = 0; i < colCount; i++) {
              doc
                .rect(x, y, colWidths[i], rowH)
                .lineWidth(0.35)
                .strokeColor(BORDER)
                .stroke();
              doc
                .font('Helvetica')
                .fontSize(8)
                .fillColor(DARK)
                .text(row[i] || '', x + padX, y + padY, {
                  width: colWidths[i] - padX * 2,
                  align: 'left',
                });
              x += colWidths[i];
            }
            y += rowH;
          }

          doc.y = y + 8;
        };

        for (const block of blocks) {
          if (block.type === 'heading') {
            const safeLevel = Math.max(
              1,
              Math.min(6, Number(block.level) || 2),
            );
            const headingSizeByLevel: Record<number, number> = {
              1: 16,
              2: 14,
              3: 12,
              4: 11,
              5: 10,
              6: 10,
            };
            const headingSize = headingSizeByLevel[safeLevel] ?? 12;
            const needed = Math.max(24, headingSize + 14);
            ensureSpace(needed);
            doc.moveDown(0.2);
            doc
              .font('Helvetica-Bold')
              .fontSize(headingSize)
              .fillColor(BLUE)
              .text(block.text, LEFT, doc.y, {
                width: PAGE_WIDTH,
              });
            doc.moveDown(0.35);
            continue;
          }
          if (block.type === 'table') {
            drawNarrativeTable(block);
            continue;
          }
          ensureSpace(42);
          doc
            .font('Helvetica')
            .fontSize(10)
            .fillColor(DARK)
            .text(block.text, LEFT, doc.y, {
              width: PAGE_WIDTH,
              align: 'justify',
            });
          doc.moveDown(0.5);
        }
      };

      const drawSituationalAndExecutiveCharts = (
        dashboard: any,
        states: any[],
      ) => {
        if (!dashboard) return;
        sectionHeader('02', 'INDICADORES E GRÁFICOS OPERACIONAIS');
        ensureSpace(70);
        const cardW = (PAGE_WIDTH - 18) / 4;
        const y = doc.y;
        valueCard(
          LEFT,
          y,
          cardW,
          String(dashboard.activities?.totalActivities ?? 0),
          'Atividades',
          BLUE,
        );
        valueCard(
          LEFT + (cardW + 6),
          y,
          cardW,
          String(dashboard.missions?.totalMissions ?? 0),
          'Missões',
          GREEN,
        );
        valueCard(
          LEFT + (cardW + 6) * 2,
          y,
          cardW,
          String(dashboard.complaints?.totalCases ?? 0),
          'Denúncias',
          RED,
        );
        valueCard(
          LEFT + (cardW + 6) * 3,
          y,
          cardW,
          String(dashboard.complaints?.openCases ?? 0),
          'Casos em aberto',
          ORANGE,
        );
        doc.y = y + 66;

        progressRow(
          'Taxa de violência relatada (pesquisas)',
          Number(dashboard.surveys?.violenceRatePercent ?? 0),
          RED,
        );
        progressRow(
          'Violência doméstica na vida',
          Number(dashboard.domesticViolence?.lifetimeRatePercent ?? 0),
          ORANGE,
        );
        progressRow(
          'Recrutas que se sentem seguros para denunciar',
          Number(dashboard.recruits?.safeToReportPercent ?? 0),
          GREEN,
        );
        progressRow(
          'Recrutas que conhecem o processo de denúncia',
          Number(dashboard.recruits?.knowReportProcessPercent ?? 0),
          BLUE_LIGHT,
        );

        const rankedStates = (states ?? [])
          .map((s: any) => ({
            label: s.uf ?? 'UF',
            total:
              Number(s.complaints ?? 0) +
              Number(s.activities ?? 0) +
              Number(s.missions ?? 0),
          }))
          .filter((s: any) => s.total > 0)
          .sort((a: any, b: any) => b.total - a.total)
          .slice(0, 8);

        if (rankedStates.length > 0) {
          ensureSpace(34);
          doc.moveDown(0.3);
          doc
            .font('Helvetica-Bold')
            .fontSize(9)
            .fillColor(BLUE)
            .text('Distribuição por UF (Top 8)', LEFT, doc.y);
          doc.moveDown(0.3);
          const max = rankedStates[0].total;
          for (const [idx, item] of rankedStates.entries()) {
            rankingRow(idx, item.label, item.total, max, BLUE);
          }
        }
      };

      const drawAggressorCharts = (profile: any) => {
        if (!profile || Number(profile.totalCases ?? 0) <= 0) return;
        sectionHeader(
          '02',
          'INDICADORES DO PERFIL DE ASSÉDIO E VIOLÊNCIA',
          RED,
        );
        progressRow(
          'Assédio moral',
          Number(profile.byComplaintType?.moral?.percent ?? 0),
          ORANGE,
        );
        progressRow(
          'Assédio sexual',
          Number(profile.byComplaintType?.sexual?.percent ?? 0),
          RED,
        );
        progressRow(
          'Casos com relação hierárquica superior-subordinado',
          Number(profile.hierarchicalRelation?.percent ?? 0),
          BLUE,
        );

        const aggressorRanks = (profile.aggressorProfile?.byRank ?? []).slice(
          0,
          6,
        );
        if (aggressorRanks.length > 0) {
          ensureSpace(30);
          doc.moveDown(0.3);
          doc
            .font('Helvetica-Bold')
            .fontSize(9)
            .fillColor(RED)
            .text('Top postos/graduações do agressor', LEFT, doc.y);
          doc.moveDown(0.3);
          const max = aggressorRanks[0]?.count ?? 1;
          for (const [idx, item] of aggressorRanks.entries()) {
            rankingRow(
              idx,
              String(item.label ?? 'Não informado'),
              Number(item.count ?? 0),
              max,
              RED,
            );
          }
        }

        const victimRanks = (profile.victimProfile?.byRank ?? []).slice(0, 6);
        if (victimRanks.length > 0) {
          ensureSpace(30);
          doc.moveDown(0.3);
          doc
            .font('Helvetica-Bold')
            .fontSize(9)
            .fillColor(BLUE)
            .text('Top postos/graduações da vítima', LEFT, doc.y);
          doc.moveDown(0.3);
          const max = victimRanks[0]?.count ?? 1;
          for (const [idx, item] of victimRanks.entries()) {
            rankingRow(
              idx,
              String(item.label ?? 'Não informado'),
              Number(item.count ?? 0),
              max,
              BLUE,
            );
          }
        }
      };

      const drawTextCharts = (textSummary: any) => {
        sectionHeader('02', 'EVIDÊNCIAS TEXTUAIS E TENDÊNCIAS', BLUE_LIGHT);
        ensureSpace(60);
        const topWords = (textSummary?.topWords ?? []).slice(0, 12);
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(GRAY)
          .text(
            `${Number(textSummary?.totalTexts ?? 0)} texto(s) livre(s) considerados.`,
            LEFT,
            doc.y,
            { width: PAGE_WIDTH },
          );
        doc.moveDown(0.4);
        if (topWords.length === 0) {
          doc
            .font('Helvetica')
            .fontSize(10)
            .fillColor(DARK)
            .text('Sem dados textuais suficientes para visualização.');
          return;
        }

        const max = Number(topWords[0]?.count ?? 1);
        for (const [idx, item] of topWords.entries()) {
          rankingRow(
            idx,
            String(item.word ?? 'termo'),
            Number(item.count ?? 0),
            max,
            BLUE_LIGHT,
          );
        }

        const sources = Object.entries(textSummary?.sources ?? {})
          .map(([key, value]: [string, any]) => ({
            key,
            count: Number(value?.count ?? 0),
          }))
          .filter((s) => s.count > 0)
          .sort((a, b) => b.count - a.count)
          .slice(0, 8);
        if (sources.length > 0) {
          ensureSpace(30);
          doc.moveDown(0.3);
          doc
            .font('Helvetica-Bold')
            .fontSize(9)
            .fillColor(BLUE)
            .text('Textos por fonte', LEFT, doc.y);
          doc.moveDown(0.3);
          const maxSource = sources[0].count;
          for (const [idx, source] of sources.entries()) {
            rankingRow(idx, source.key, source.count, maxSource, GREEN);
          }
        }
      };

      const drawGeoCharts = (geoMap: any) => {
        sectionHeader('02', 'DISTRIBUIÇÃO GEOGRÁFICA', ORANGE);
        const states = (geoMap?.states ?? [])
          .map((s: any) => ({
            uf: String(s.uf ?? 'UF'),
            complaints: Number(s.complaints ?? 0),
            activities: Number(s.activities ?? 0),
            missions: Number(s.missions ?? 0),
            total:
              Number(s.complaints ?? 0) +
              Number(s.activities ?? 0) +
              Number(s.missions ?? 0),
          }))
          .filter((s: any) => s.total > 0)
          .sort((a: any, b: any) => b.total - a.total);

        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(GRAY)
          .text(
            `${states.length} UF(s) com ocorrências. Localidades com UF: ${Number(geoMap?.totalLocalitiesWithUf ?? 0)}.`,
            LEFT,
            doc.y,
            { width: PAGE_WIDTH },
          );
        doc.moveDown(0.4);

        if (states.length === 0) {
          doc
            .font('Helvetica')
            .fontSize(10)
            .fillColor(DARK)
            .text('Sem dados geográficos suficientes para gráficos.');
          return;
        }

        const max = states[0].total;
        for (const [idx, item] of states.slice(0, 12).entries()) {
          rankingRow(
            idx,
            `${item.uf} (D:${item.complaints} A:${item.activities} M:${item.missions})`,
            item.total,
            max,
            ORANGE,
          );
        }
      };

      // Capa
      doc.rect(0, 0, doc.page.width, 84).fill(BLUE);
      doc.rect(0, 84, doc.page.width, 4).fill(ORANGE);
      doc
        .font('Helvetica-Bold')
        .fontSize(22)
        .fillColor('#FFFFFF')
        .text('RELATÓRIO DE ANÁLISE IA', LEFT, 20, {
          width: PAGE_WIDTH,
          align: 'center',
        });
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#D8E3F1')
        .text('Sistema CIPAVD / SMIF', LEFT, 50, {
          width: PAGE_WIDTH,
          align: 'center',
        });

      doc.y = 104;
      doc
        .roundedRect(LEFT, doc.y, PAGE_WIDTH, 56, 6)
        .fill(BG)
        .strokeColor(BORDER)
        .lineWidth(0.6)
        .stroke();
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor(BLUE)
        .text(title, LEFT + 12, doc.y + 10, {
          width: PAGE_WIDTH - 24,
        });
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(GRAY)
        .text(
          `Modelo: ${args.model}  |  Gerado em: ${this.formatDateTimePtBr(args.generatedAt)}`,
          LEFT + 12,
          doc.y + 32,
          { width: PAGE_WIDTH - 24 },
        );
      doc.y += 70;

      drawNarrative();

      if (args.type === 'executive' || args.type === 'situational') {
        const dashboard = args.data?.dashboard;
        const states =
          args.type === 'executive'
            ? (args.data?.geoSummary?.statesSample ?? [])
            : [];
        drawSituationalAndExecutiveCharts(dashboard, states);
      } else if (args.type === 'aggressor') {
        drawAggressorCharts(args.data?.profile);
      } else if (args.type === 'text') {
        drawTextCharts(args.data?.textSummary);
      } else if (args.type === 'geo') {
        drawGeoCharts(args.data?.geoMap);
      }

      ensureSpace(24);
      doc.moveDown(1.2);
      doc
        .moveTo(LEFT, doc.y)
        .lineTo(LEFT + PAGE_WIDTH, doc.y)
        .strokeColor(BORDER)
        .lineWidth(0.6)
        .stroke();
      doc.moveDown(0.3);
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(GRAY)
        .text(
          'Documento de apoio à decisão. Uso interno institucional. Os gráficos refletem os dados disponíveis no momento da geração.',
          LEFT,
          doc.y,
          { width: PAGE_WIDTH, align: 'center' },
        );

      doc.end();
    });
  }

  private parseNarrativeBlocksForPdf(narrative: string): NarrativePdfBlock[] {
    const lines = String(narrative || '')
      .replace(/\r/g, '')
      .split('\n');

    if (!lines.some((line) => line.trim())) {
      return [
        {
          type: 'paragraph',
          text: 'Análise ainda não disponível para esta execução.',
        },
      ];
    }

    const blocks: NarrativePdfBlock[] = [];
    const paragraphBuffer: string[] = [];

    const flushParagraph = () => {
      if (paragraphBuffer.length === 0) return;
      const text = paragraphBuffer.join('\n').trim();
      paragraphBuffer.length = 0;
      if (!text) return;
      blocks.push({ type: 'paragraph', text });
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        flushParagraph();
        blocks.push({
          type: 'heading',
          level: headingMatch[1].length,
          text: this.normalizeInlineMarkdown(headingMatch[2]).trim(),
        });
        continue;
      }

      const boldOnlyMatch = trimmed.match(/^\*\*(.+)\*\*$/);
      if (boldOnlyMatch && !trimmed.includes('|')) {
        flushParagraph();
        blocks.push({
          type: 'heading',
          level: 3,
          text: this.normalizeInlineMarkdown(boldOnlyMatch[1]).trim(),
        });
        continue;
      }

      const looksLikeTableHeader =
        trimmed.includes('|') &&
        i + 1 < lines.length &&
        this.isMarkdownTableSeparator(lines[i + 1] ?? '');

      if (looksLikeTableHeader) {
        flushParagraph();
        const header = this.parseMarkdownTableRow(line);
        const rows: string[][] = [];
        i += 1; // pula linha de separador
        while (i + 1 < lines.length) {
          const rowLine = lines[i + 1] ?? '';
          if (!rowLine.trim() || !rowLine.includes('|')) break;
          const parsed = this.parseMarkdownTableRow(rowLine);
          if (parsed.length >= 2) rows.push(parsed);
          i += 1;
        }
        if (header.length >= 2) {
          blocks.push({ type: 'table', header, rows });
        }
        continue;
      }

      if (!trimmed) {
        flushParagraph();
        continue;
      }

      paragraphBuffer.push(this.normalizeInlineMarkdown(line).trim());
    }

    flushParagraph();
    if (blocks.length === 0) {
      return [
        {
          type: 'paragraph',
          text: 'Análise ainda não disponível para esta execução.',
        },
      ];
    }
    return blocks;
  }

  private isMarkdownTableSeparator(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes('-') || !trimmed.includes('|')) {
      return false;
    }
    const withoutEdges = trimmed.replace(/^\|/, '').replace(/\|$/, '');
    const parts = withoutEdges.split('|').map((part) => part.trim());
    if (parts.length < 2) return false;
    return parts.every((part) => /^:?-{3,}:?$/.test(part));
  }

  private parseMarkdownTableRow(line: string): string[] {
    const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    return trimmed
      .split('|')
      .map((cell) => this.normalizeInlineMarkdown(cell).trim());
  }

  private normalizeInlineMarkdown(text: string): string {
    return String(text || '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^[-*]\s+/, '• ')
      .replace(/\\([%|/])/g, '$1')
      .replace(/\n{3,}/g, '\n\n');
  }

  private normalizeActionAgentType(type: ActionAgentType): ActionAgentType {
    return ACTION_AGENT_CATALOG.some((item) => item.type === type)
      ? type
      : 'briefing_comgep';
  }

  private normalizeComgepMode(
    value: ComgepCopilotMode | string | null | undefined,
  ): ComgepCopilotMode {
    return String(value ?? '').trim().toLowerCase() === 'analyst'
      ? 'analyst'
      : 'executive';
  }

  private normalizeComgepFocus(
    value: Partial<ComgepCopilotFocus> | null | undefined,
    scopeUf: string | null,
  ): ComgepCopilotFocus | null {
    if (!value || typeof value !== 'object') {
      return scopeUf
        ? {
            kind: 'uf',
            label: `UF ${scopeUf}`,
            description: `Leitura concentrada na UF ${scopeUf}.`,
            uf: scopeUf,
          }
        : null;
    }

    const kindSet = new Set<ComgepCopilotFocus['kind']>([
      'overview',
      'kpi_covered_oms',
      'kpi_critical_ufs',
      'kpi_high_risk_oms',
      'kpi_operational_presence',
      'uf',
      'om',
      'coverage_gap',
      'operational_pressure',
    ]);
    const rawKind = String(value.kind ?? '').trim() as ComgepCopilotFocus['kind'];
    const kind = kindSet.has(rawKind) ? rawKind : 'overview';
    const uf = String(value.uf ?? '').trim().toUpperCase() || scopeUf || null;
    const focus: ComgepCopilotFocus = {
      kind,
      label: String(value.label ?? '').trim() || undefined,
      description: String(value.description ?? '').trim() || undefined,
      uf:
        kind === 'uf' ||
        kind === 'coverage_gap' ||
        kind === 'operational_pressure'
          ? uf
          : uf && kind === 'overview'
            ? uf
            : value.uf
              ? uf
              : null,
      omId: String(value.omId ?? '').trim() || null,
      refId: String(value.refId ?? '').trim() || null,
    };

    return focus;
  }

  private createComgepSession(args: {
    agentType: ActionAgentType;
    scopeUf: string | null;
    mode: ComgepCopilotMode;
    focus: ComgepCopilotFocus | null;
  }) {
    const now = new Date().toISOString();
    const session: ComgepCopilotSession = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      agentType: args.agentType,
      scopeUf: args.scopeUf,
      mode: args.mode,
      focus: args.focus,
      messages: [],
    };
    this.comgepSessions.set(session.id, session);
    return session;
  }

  private pushComgepMessage(
    session: ComgepCopilotSession,
    input: Omit<ComgepCopilotMessage, 'id' | 'createdAt' | 'agentType'>,
  ) {
    const message: ComgepCopilotMessage = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      agentType: session.agentType,
      ...input,
    };
    session.messages = [...session.messages.slice(-11), message];
    session.updatedAt = message.createdAt;
    session.mode = input.mode;
    session.focus = input.focus;
    this.comgepSessions.set(session.id, session);
    return message;
  }

  private pruneComgepSessions() {
    const now = Date.now();
    for (const [sessionId, session] of this.comgepSessions.entries()) {
      const updatedAtMs = new Date(session.updatedAt).getTime();
      if (
        !Number.isFinite(updatedAtMs) ||
        now - updatedAtMs > this.comgepSessionTtlMs
      ) {
        this.comgepSessions.delete(sessionId);
      }
    }
  }

  private getComgepSessionOrThrow(sessionId: string) {
    this.pruneComgepSessions();
    const safeSessionId = String(sessionId ?? '').trim();
    if (!safeSessionId) {
      throw new NotFoundException('Sessão do copiloto não informada.');
    }
    const session = this.comgepSessions.get(safeSessionId);
    if (!session) {
      throw new NotFoundException(
        'Sessão do copiloto expirou ou não foi encontrada.',
      );
    }
    return session;
  }

  private buildInitialComgepUserMessage(
    agentType: ActionAgentType,
    mode: ComgepCopilotMode,
    focus: ComgepCopilotFocus | null,
    scopeUf: string | null,
  ) {
    const agent = ACTION_AGENT_CATALOG.find((item) => item.type === agentType);
    const scopeLabel = scopeUf ? `na UF ${scopeUf}` : 'em visão nacional';
    return `Executar ${agent?.title ?? 'copiloto COMGEP'} no modo ${mode === 'analyst' ? 'analista' : 'executivo'} ${scopeLabel}, com foco em ${this.describeComgepFocus(focus, scopeUf)}.`;
  }

  private describeComgepFocus(
    focus: ComgepCopilotFocus | null,
    scopeUf: string | null,
  ) {
    if (!focus) {
      return scopeUf
        ? `cenário geral da UF ${scopeUf}`
        : 'cenário geral da Sala COMGEP';
    }
    if (focus.label) return focus.label;
    switch (focus.kind) {
      case 'kpi_covered_oms':
        return 'OMs cobertas pela CPCA';
      case 'kpi_critical_ufs':
        return 'UFs prioritárias';
      case 'kpi_high_risk_oms':
        return 'OMs de maior risco';
      case 'kpi_operational_presence':
        return 'presença operacional';
      case 'uf':
        return focus.uf ? `UF ${focus.uf}` : 'UF selecionada';
      case 'om':
        return focus.description || 'OM selecionada';
      case 'coverage_gap':
        return focus.description || 'gaps de cobertura CPCA';
      case 'operational_pressure':
        return focus.description || 'pressão operacional';
      default:
        return scopeUf
          ? `cenário geral da UF ${scopeUf}`
          : 'cenário geral da Sala COMGEP';
    }
  }

  private async *streamComgepAssistantCompletion(
    params: ComgepCopilotStreamParams,
  ): AsyncGenerator<string, { narrative: string; model: string }, void> {
    const systemPrompt = await this.settings.getSystemPrompt();
    const prompt = this.buildComgepCopilotPrompt(params);
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ];

    yield this.sseEvent('progress', {
      percent: 30,
      stage: 'Enviando ao modelo...',
    });

    const configuredModel = this.litellm.getDefaultModel();
    const iterator = this.litellm
      .chatCompletionStream({
        messages,
        temperature: params.mode === 'analyst' ? 0.12 : 0.18,
        max_tokens: params.mode === 'analyst' ? 1900 : 1500,
      })
      [Symbol.asyncIterator]();

    let tokenCount = 0;
    let fullText = '';

    try {
      while (true) {
        let timeoutHandle: NodeJS.Timeout | undefined;
        let next: IteratorResult<
          { type: 'token'; text: string } | { type: 'done'; model: string }
        >;
        try {
          next = (await Promise.race([
            iterator.next(),
            new Promise<IteratorResult<any>>((_, reject) => {
              timeoutHandle = setTimeout(() => {
                reject(new Error('LITELLM_STREAM_IDLE_TIMEOUT'));
              }, this.streamIdleTimeoutMs);
            }),
          ])) as IteratorResult<any>;
        } finally {
          if (timeoutHandle) clearTimeout(timeoutHandle);
        }
        if (next.done) break;

        const chunk = next.value;
        if (chunk.type === 'token') {
          fullText += chunk.text;
          tokenCount += 1;
          const progress = Math.min(
            95,
            32 + Math.floor((tokenCount / 240) * 63),
          );
          yield this.sseEvent('token', { text: chunk.text, percent: progress });
          continue;
        }

        if (!fullText.trim()) {
          yield this.sseEvent('progress', {
            percent: 88,
            stage: 'Recuperando resposta final do modelo...',
          });
          const fallback = await this.litellm.chatCompletion({
            messages,
            temperature: params.mode === 'analyst' ? 0.12 : 0.18,
            max_tokens: params.mode === 'analyst' ? 1800 : 1400,
          });
          fullText = fallback.content.trim();
          if (!fullText) {
            throw new Error(
              'O modelo encerrou a execução sem gerar conteúdo útil.',
            );
          }
          return {
            narrative: fullText,
            model: fallback.model,
          };
        }

        return {
          narrative: fullText,
          model: chunk.model,
        };
      }
    } catch (e) {
      let msg = e instanceof Error ? e.message : String(e);
      if (msg === 'LITELLM_STREAM_IDLE_TIMEOUT') {
        msg =
          `Sem resposta do modelo por ${Math.round(this.streamIdleTimeoutMs / 1000)}s ` +
          `(modelo configurado: ${configuredModel}). Verifique disponibilidade no LiteLLM.`;
      }
      throw new Error(msg);
    }

    return {
      narrative: fullText,
      model: configuredModel,
    };
  }

  private buildComgepCopilotPrompt(params: ComgepCopilotStreamParams) {
    const scopeLabel = params.scopeUf
      ? `UF ${params.scopeUf}`
      : 'visão nacional';
    const focusLabel = this.describeComgepFocus(params.focus, params.scopeUf);
    const roomSummary = this.buildCompactActionAgentContext(
      params.room,
      params.scopeUf,
    );
    const compactRoomJson = this.truncateText(
      JSON.stringify(roomSummary, null, 2),
      14_000,
    );
    const evidenceLines =
      params.evidences.length > 0
        ? params.evidences
            .slice(0, 8)
            .map(
              (item, index) =>
                `${index + 1}. ${item.omCode} | ${item.uf} | score ${item.score} | ${item.reason} | ${item.link}`,
            )
            .join('\n')
        : 'Nenhuma evidência OM específica foi selecionada. Use o resumo da sala.';
    const historyLines =
      params.history.length > 0
        ? params.history
            .slice(-6)
            .map((item) => {
              const roleLabel =
                item.role === 'assistant' ? 'Assistente' : 'Usuário';
              const focusLabelLine = this.describeComgepFocus(
                item.focus,
                params.scopeUf,
              );
              return `- ${roleLabel} [modo=${item.mode}; foco=${focusLabelLine}]: ${this.truncateText(
                this.normalizeInlineMarkdown(item.content),
                420,
              )}`;
            })
            .join('\n')
        : 'Sem histórico anterior.';

    const modeInstruction =
      params.mode === 'analyst'
        ? [
            'Modo analista: detalhe a lógica, mas de forma objetiva.',
            'Explique por que a conclusão foi formada, cite lacunas e mostre rastreabilidade.',
            'Estruture em: 1) Resposta direta; 2) Evidências; 3) Riscos e limites; 4) Encaminhamento.',
          ].join(' ')
        : [
            'Modo executivo: responda curto e direto.',
            'Estruture em: 1) Síntese; 2) Decisão recomendada; 3) Risco se nada for feito; 4) Próxima ação.',
            'Use no máximo 4 bullets por seção.',
          ].join(' ');

    const instructionsByType: Record<ActionAgentType, string> = {
      briefing_comgep:
        'Você é o copiloto executivo da Sala COMGEP. Seu papel é transformar o quadro atual em decisão objetiva para o gestor.',
      priorizacao_intervencao:
        'Você é o copiloto de priorização. Seu papel é ordenar esforço, comparar impacto e sugerir a melhor sequência de intervenção.',
      governanca_cpca:
        'Você é o copiloto de governança CPCA. Seu papel é explicar cobertura, gargalos, risco de exposição institucional e ajuste de comissão.',
    };

    return [
      instructionsByType[params.agentType],
      `Escopo ativo: ${scopeLabel}.`,
      `Foco atual: ${focusLabel}.`,
      modeInstruction,
      'Use somente o contexto fornecido. Não invente números nem links.',
      'Quando citar uma conclusão, explicite OM/UF, score e motivo sempre que existirem nas evidências.',
      'Não use tabelas markdown.',
      '',
      'Histórico resumido da sessão:',
      historyLines,
      '',
      'Pergunta ou comando atual do usuário:',
      params.userMessage,
      '',
      'Evidências selecionadas para esta resposta:',
      evidenceLines,
      '',
      'Resumo estruturado da Sala COMGEP:',
      compactRoomJson,
    ].join('\n');
  }

  private selectComgepEvidences(args: {
    room: any;
    scopeUf: string | null;
    focus: ComgepCopilotFocus | null;
    agentType: ActionAgentType;
  }): ComgepCopilotEvidenceItem[] {
    const byId = new Map<string, ComgepCopilotEvidenceItem>();
    const add = (item: any, source: string, reason?: string | null) => {
      if (!item) return;
      const omId = String(item.id ?? item.omId ?? '').trim() || null;
      const code = String(item.code ?? item.omCode ?? '').trim();
      const name = String(item.name ?? item.omName ?? '').trim();
      const uf = String(item.uf ?? '').trim().toUpperCase();
      if (!code || !uf) return;
      const evidence: ComgepCopilotEvidenceItem = {
        id: omId || `${code}-${uf}-${source}`,
        type: 'om',
        omId,
        omCode: code,
        omName: name || code,
        title: name ? `${code} - ${name}` : code,
        uf,
        score: Number(item.riskScore ?? item.score ?? 0),
        reason:
          String(reason ?? '').trim() ||
          this.describeComgepEvidenceReason(item, source),
        link:
          String(item.link ?? '').trim() ||
          `/cpca-cases?omId=${encodeURIComponent(omId ?? code)}`,
        source,
        coverageType: String(item.coverageType ?? '').trim() || null,
      };
      byId.set(evidence.id, evidence);
    };

    const omRiskIndex = Array.isArray(args.room?.details?.omRiskIndex)
      ? args.room.details.omRiskIndex
      : [];
    const ufMatrix = Array.isArray(args.room?.details?.ufMatrix)
      ? args.room.details.ufMatrix
      : [];
    const highRiskOms = Array.isArray(args.room?.details?.highRiskOms)
      ? args.room.details.highRiskOms
      : [];
    const uncoveredOms = Array.isArray(args.room?.details?.uncoveredOms)
      ? args.room.details.uncoveredOms
      : [];
    const coveredOms = Array.isArray(args.room?.details?.coveredOms)
      ? args.room.details.coveredOms
      : [];

    const addUfTopOms = (uf: string | null | undefined, source: string) => {
      const safeUf = String(uf ?? '').trim().toUpperCase();
      if (!safeUf) return;
      const ufRow = ufMatrix.find(
        (item: any) => String(item?.uf ?? '').trim().toUpperCase() === safeUf,
      );
      const ufOms = Array.isArray(ufRow?.oms) ? ufRow.oms.slice(0, 6) : [];
      for (const om of ufOms) add(om, source);
    };

    switch (args.focus?.kind) {
      case 'kpi_covered_oms':
        coveredOms.slice(0, 8).forEach((item: any) =>
          add(item, 'Cobertura CPCA'),
        );
        break;
      case 'kpi_high_risk_oms':
        highRiskOms.slice(0, 8).forEach((item: any) =>
          add(item, 'OMs de maior risco'),
        );
        break;
      case 'kpi_critical_ufs':
        (Array.isArray(args.room?.details?.criticalUfs)
          ? args.room.details.criticalUfs
          : []
        )
          .slice(0, 4)
          .forEach((item: any) => addUfTopOms(item.uf, 'UF prioritária'));
        break;
      case 'kpi_operational_presence':
        (Array.isArray(args.room?.details?.operationalPresenceByUf)
          ? args.room.details.operationalPresenceByUf
          : []
        )
          .slice(0, 4)
          .forEach((item: any) =>
            addUfTopOms(item.uf, 'Presença operacional'),
          );
        break;
      case 'uf':
      case 'operational_pressure':
        addUfTopOms(args.focus.uf, 'UF em foco');
        break;
      case 'om': {
        const om = omRiskIndex.find(
          (item: any) =>
            String(item?.id ?? '').trim() === String(args.focus?.omId ?? '').trim(),
        );
        add(om, 'OM em foco');
        break;
      }
      case 'coverage_gap':
        if (args.focus.omId) {
          const om = uncoveredOms.find(
            (item: any) =>
              String(item?.id ?? '').trim() ===
              String(args.focus?.omId ?? '').trim(),
          );
          add(om, 'Gap de cobertura');
        } else {
          uncoveredOms.slice(0, 8).forEach((item: any) =>
            add(item, 'Gap de cobertura'),
          );
        }
        break;
      default:
        break;
    }

    if (byId.size === 0 && args.scopeUf) {
      addUfTopOms(args.scopeUf, 'Escopo da sessão');
    }

    if (byId.size === 0) {
      const baseList =
        args.agentType === 'governanca_cpca'
          ? uncoveredOms
          : args.agentType === 'priorizacao_intervencao'
            ? highRiskOms
            : omRiskIndex;
      baseList.slice(0, 8).forEach((item: any) =>
        add(
          item,
          args.agentType === 'governanca_cpca'
            ? 'Governança CPCA'
            : args.agentType === 'priorizacao_intervencao'
              ? 'Priorização'
              : 'Sala COMGEP',
        ),
      );
    }

    return Array.from(byId.values()).slice(0, 8);
  }

  private describeComgepEvidenceReason(item: any, source: string) {
    const sourceLabel = String(source ?? '').trim();
    const complaints = item?.complaints ?? {};
    const openCases = Number(complaints?.openCases ?? 0);
    const retaliationCases = Number(complaints?.retaliationCases ?? 0);
    const stalledCases = Number(complaints?.stalledCases ?? 0);
    const surveyRate = Number(item?.surveyRate ?? 0);
    const domesticRate = Number(item?.domesticRate ?? 0);
    const reasons: string[] = [];
    if (openCases > 0) reasons.push(`${openCases} denúncia(s) aberta(s)`);
    if (retaliationCases > 0) {
      reasons.push(`${retaliationCases} risco(s) de retaliação`);
    }
    if (stalledCases > 0) reasons.push(`${stalledCases} caso(s) parado(s)`);
    if (surveyRate >= 20) {
      reasons.push(`${surveyRate.toFixed(1)}% de sinal em pesquisa`);
    }
    if (domesticRate >= 15) {
      reasons.push(`${domesticRate.toFixed(1)}% em violência doméstica`);
    }
    if (!reasons.length && item?.coverageType) {
      reasons.push(String(item.coverageType));
    }
    if (!reasons.length) reasons.push(`evidência selecionada em ${sourceLabel}`);
    return `${sourceLabel}: ${reasons.join(' • ')}`;
  }

  private extractEvidenceLinks(evidences: ComgepCopilotEvidenceItem[]) {
    return evidences.map((item) => ({
      omId: item.omId,
      omCode: item.omCode,
      title: item.title,
      link: item.link,
    }));
  }

  private async renderComgepSessionPdf(
    session: ComgepCopilotSession,
  ): Promise<Buffer> {
    const agent = ACTION_AGENT_CATALOG.find(
      (item) => item.type === session.agentType,
    );
    const latestAssistant = [...session.messages]
      .reverse()
      .find((item) => item.role === 'assistant');
    const latestUser = [...session.messages]
      .reverse()
      .find((item) => item.role === 'user');
    const evidences = latestAssistant?.evidences ?? [];
    const narrativeBlocks = this.parseNarrativeBlocksForPdf(
      latestAssistant?.content ?? '',
    );

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 44,
        bufferPages: true,
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const LEFT = 44;
      const WIDTH = doc.page.width - LEFT * 2;
      const PAGE_BOTTOM = doc.page.height - 44;
      const BLUE = '#1A3C6E';
      const DARK = '#1F2937';
      const GRAY = '#6B7280';
      const BORDER = '#D7DEE9';

      const ensureSpace = (height: number) => {
        if (doc.y + height > PAGE_BOTTOM) doc.addPage();
      };

      const section = (title: string) => {
        ensureSpace(28);
        doc.roundedRect(LEFT, doc.y, WIDTH, 22, 4).fill(BLUE);
        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor('#FFFFFF')
          .text(title, LEFT + 10, doc.y + 6, { width: WIDTH - 20 });
        doc.y += 30;
      };

      doc
        .font('Helvetica-Bold')
        .fontSize(18)
        .fillColor(BLUE)
        .text('Caderno do Copiloto COMGEP', LEFT, doc.y, { width: WIDTH });
      doc.moveDown(0.25);
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(GRAY)
        .text(
          `${agent?.title ?? 'Copiloto COMGEP'} • sessão ${session.id.slice(0, 8)} • ${this.formatDateTimePtBr(session.updatedAt)}`,
          LEFT,
          doc.y,
          { width: WIDTH },
        );
      doc.moveDown(0.6);

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(DARK)
        .text(`Modo: ${session.mode === 'analyst' ? 'Analista' : 'Executivo'}`)
        .text(
          `Foco: ${this.describeComgepFocus(session.focus, session.scopeUf)}`,
        )
        .text(`Escopo: ${session.scopeUf ? `UF ${session.scopeUf}` : 'Nacional'}`)
        .text(`Mensagens na sessão: ${session.messages.length}`);
      doc.moveDown(0.6);

      section('Pergunta mais recente');
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(DARK)
        .text(latestUser?.content || 'Sem pergunta registrada.', LEFT, doc.y, {
          width: WIDTH,
          align: 'justify',
        });
      doc.moveDown(0.6);

      section('Resposta consolidada');
      for (const block of narrativeBlocks) {
        if (block.type === 'heading') {
          ensureSpace(20);
          doc
            .font('Helvetica-Bold')
            .fontSize(12)
            .fillColor(BLUE)
            .text(block.text, LEFT, doc.y, { width: WIDTH });
          doc.moveDown(0.25);
          continue;
        }
        if (block.type === 'table') {
          const header = block.header.join(' | ');
          const rows = block.rows.map((row) => row.join(' | ')).join('\n');
          ensureSpace(36);
          doc
            .font('Helvetica-Bold')
            .fontSize(9)
            .fillColor(DARK)
            .text(header, LEFT, doc.y, { width: WIDTH });
          doc.moveDown(0.15);
          doc
            .font('Helvetica')
            .fontSize(8.5)
            .fillColor(DARK)
            .text(rows, LEFT, doc.y, { width: WIDTH });
          doc.moveDown(0.35);
          continue;
        }
        ensureSpace(42);
        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor(DARK)
          .text(block.text, LEFT, doc.y, {
            width: WIDTH,
            align: 'justify',
          });
        doc.moveDown(0.45);
      }

      section('Evidências vinculadas');
      if (!evidences.length) {
        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor(DARK)
          .text('Esta resposta não retornou evidências OM estruturadas.', LEFT, doc.y, {
            width: WIDTH,
          });
      } else {
        for (const item of evidences) {
          ensureSpace(42);
          doc
            .roundedRect(LEFT, doc.y, WIDTH, 38, 4)
            .lineWidth(0.6)
            .strokeColor(BORDER)
            .stroke();
          doc
            .font('Helvetica-Bold')
            .fontSize(10)
            .fillColor(BLUE)
            .text(
              `${item.omCode} • ${item.uf} • score ${item.score}`,
              LEFT + 10,
              doc.y + 8,
              { width: WIDTH - 20 },
            );
          doc
            .font('Helvetica')
            .fontSize(9)
            .fillColor(DARK)
            .text(item.reason, LEFT + 10, doc.y + 20, {
              width: WIDTH - 20,
            });
          doc.y += 46;
        }
      }

      section('Memória resumida da sessão');
      for (const item of session.messages.slice(-8)) {
        ensureSpace(26);
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(item.role === 'assistant' ? BLUE : DARK)
          .text(
            `${item.role === 'assistant' ? 'Assistente' : 'Usuário'} • ${this.formatDateTimePtBr(item.createdAt)}`,
            LEFT,
            doc.y,
            { width: WIDTH },
          );
        doc
          .font('Helvetica')
          .fontSize(8.8)
          .fillColor(DARK)
          .text(this.truncateText(this.normalizeInlineMarkdown(item.content), 900), LEFT, doc.y + 2, {
            width: WIDTH,
          });
        doc.moveDown(0.35);
      }

      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i += 1) {
        doc.switchToPage(i);
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(GRAY)
          .text(
            `Documento restrito • Copiloto COMGEP • Página ${i + 1}/${range.count}`,
            LEFT,
            doc.page.height - 28,
            { width: WIDTH, align: 'center' },
          );
      }

      doc.end();
    });
  }

  private buildCompactActionAgentContext(room: any, scopeUf: string | null) {
    const matchesScope = (item: any) =>
      scopeUf
        ? String(item?.uf ?? '').trim().toUpperCase() === scopeUf
        : true;

    const scopedCriticalUfs = Array.isArray(room?.watchlists?.criticalUfs)
      ? room.watchlists.criticalUfs.filter(matchesScope)
      : [];
    const scopedOms = Array.isArray(room?.watchlists?.topRiskOms)
      ? room.watchlists.topRiskOms.filter(matchesScope)
      : [];
    const scopedCoverageGaps = Array.isArray(room?.watchlists?.coverageGaps)
      ? room.watchlists.coverageGaps.filter(matchesScope)
      : [];
    const scopedPressure = Array.isArray(room?.watchlists?.operationalPressure)
      ? room.watchlists.operationalPressure.filter(matchesScope)
      : [];

    const confidenceSources = Array.isArray(room?.dataConfidence?.sources)
      ? [...room.dataConfidence.sources]
          .filter((item: any) => Number(item?.totalRecords ?? 0) > 0)
          .sort(
            (a: any, b: any) =>
              Number(b?.totalRecords ?? 0) - Number(a?.totalRecords ?? 0),
          )
          .slice(0, 6)
          .map((item: any) => ({
            fonte: item?.label ?? 'Fonte não identificada',
            capacidade: item?.capability ?? 'N/A',
            registros: Number(item?.totalRecords ?? 0),
            coberturaPercentual: Number(item?.coveragePercent ?? 0),
            correspondidos: Number(item?.statusCounts?.matched ?? 0),
            apenasUf: Number(item?.statusCounts?.ufOnly ?? 0),
            naoEncontrados: Number(item?.statusCounts?.notFound ?? 0),
            ultimaAtualizacao: item?.latestUpdatedAt ?? null,
          }))
      : [];

    return {
      generatedAt: room?.generatedAt ?? new Date().toISOString(),
      escopo: scopeUf ? `UF ${scopeUf}` : 'Nacional',
      resumo: {
        totalOms: Number(room?.summary?.totalOms ?? 0),
        omsCobertasCpca: Number(room?.summary?.coveredOms ?? 0),
        percentualCoberturaCpca: Number(room?.summary?.coveredOmsPercent ?? 0),
        ufsCriticas: Number(room?.summary?.criticalUfCount ?? 0),
        omsAltoRisco: Number(room?.summary?.highRiskOmCount ?? 0),
        denunciasAbertas: Number(room?.summary?.openComplaintCases ?? 0),
        eventosPresencaOperacional: Number(
          room?.summary?.operationalPresenceEvents ?? 0,
        ),
      },
      confiancaDado: {
        coberturaSuportadaPercentual: Number(
          room?.dataConfidence?.supportedCoveragePercent ?? 0,
        ),
        registrosNormalizados: Number(room?.dataConfidence?.totalRecords ?? 0),
        correspondidos: Number(room?.dataConfidence?.matched ?? 0),
        apenasUf: Number(room?.dataConfidence?.ufOnly ?? 0),
        naoEncontrados: Number(room?.dataConfidence?.notFound ?? 0),
        ultimaAtualizacao: room?.dataConfidence?.lastUpdatedAt ?? null,
        principaisFontes: confidenceSources,
      },
      ufsPrioritarias: scopedCriticalUfs.slice(0, 6).map((item: any) => ({
        uf: item?.uf ?? 'N/D',
        faixa: item?.priorityBand ?? 'N/D',
        risco: Number(item?.riskScore ?? 0),
        coberturaCpcaPercentual: Number(item?.coveragePercent ?? 0),
        presencaOperacional: Number(item?.presenceScore ?? 0),
        denunciasAbertas: Number(item?.complaints?.openCases ?? 0),
        retaliacao: Number(item?.complaints?.retaliationCases ?? 0),
        taxaViolenciaPesquisa: Number(item?.surveyRate ?? 0),
        taxaViolenciaDomestica: Number(item?.domesticRate ?? 0),
        omsMaisSensíveis: Array.isArray(item?.oms)
          ? item.oms
              .slice(0, 4)
              .map(
                (om: any) =>
                  `${String(om?.code ?? 'OM')} (${Number(om?.riskScore ?? 0)})`,
              )
          : [],
        focoRecomendado: this.truncateText(item?.recommendedFocus, 180),
      })),
      omsMaiorRisco: scopedOms.slice(0, 8).map((item: any) => ({
        om: this.formatActionAgentOmLabel(item),
        uf: item?.uf ?? 'N/D',
        risco: Number(item?.riskScore ?? 0),
        cobertura: item?.coverageType ?? 'N/D',
        denunciasAbertas: Number(item?.complaints?.openCases ?? 0),
        retaliacao: Number(item?.complaints?.retaliationCases ?? 0),
        casosParados: Number(item?.complaints?.stalledCases ?? 0),
        casosSexuais: Number(item?.complaints?.sexualCases ?? 0),
        taxaViolenciaPesquisa: Number(item?.surveyRate ?? 0),
        taxaViolenciaDomestica: Number(item?.domesticRate ?? 0),
        motivo: this.describeActionAgentOmRisk(item),
      })),
      gapsCoberturaCpca: scopedCoverageGaps.slice(0, 8).map((item: any) => ({
        om: this.formatActionAgentOmLabel(item),
        uf: item?.uf ?? 'N/D',
        risco: Number(item?.riskScore ?? 0),
        denunciasAbertas: Number(item?.complaints?.openCases ?? 0),
        retaliacao: Number(item?.complaints?.retaliationCases ?? 0),
        motivo: this.describeActionAgentCoverageGap(item),
      })),
      pressaoOperacional: scopedPressure.slice(0, 6).map((item: any) => ({
        uf: item?.uf ?? 'N/D',
        pressao: Number(item?.pressureScore ?? 0),
        risco: Number(item?.riskScore ?? 0),
        presenca: Number(item?.presenceScore ?? 0),
        coberturaCpcaPercentual: Number(item?.coveragePercent ?? 0),
        missoes: Number(item?.presence?.missions ?? 0),
        atividadesConcluidas: Number(
          item?.presence?.completedActivities ?? 0,
        ),
        relatoriosAssinados: Number(item?.presence?.signedReports ?? 0),
        focoRecomendado: this.truncateText(item?.recommendedFocus, 180),
      })),
    };
  }

  private formatActionAgentOmLabel(item: any) {
    const code = String(item?.code ?? '').trim();
    const name = String(item?.name ?? '').trim();
    if (code && name) return `${code} - ${name}`;
    return code || name || 'OM não identificada';
  }

  private describeActionAgentOmRisk(item: any) {
    const reasons: string[] = [];
    const openCases = Number(item?.complaints?.openCases ?? 0);
    const retaliationCases = Number(item?.complaints?.retaliationCases ?? 0);
    const stalledCases = Number(item?.complaints?.stalledCases ?? 0);
    const sexualCases = Number(item?.complaints?.sexualCases ?? 0);
    const surveyRate = Number(item?.surveyRate ?? 0);
    const domesticRate = Number(item?.domesticRate ?? 0);

    if (openCases > 0) reasons.push(`${openCases} denúncia(s) aberta(s)`);
    if (retaliationCases > 0) {
      reasons.push(`${retaliationCases} caso(s) com risco de retaliação`);
    }
    if (stalledCases > 0) reasons.push(`${stalledCases} caso(s) parado(s)`);
    if (sexualCases > 0) reasons.push(`${sexualCases} caso(s) sexual(is)`);
    if (surveyRate >= 20) {
      reasons.push(
        `${surveyRate.toFixed(1)}% de sinal em pesquisa de violência`,
      );
    }
    if (domesticRate >= 15) {
      reasons.push(
        `${domesticRate.toFixed(1)}% de sinal em violência doméstica`,
      );
    }
    if (!reasons.length) {
      reasons.push('pontuação elevada no índice composto de risco');
    }
    return this.truncateText(reasons.join('; '), 220);
  }

  private describeActionAgentCoverageGap(item: any) {
    const reasons: string[] = ['OM sem cobertura CPCA própria ou delegada'];
    const openCases = Number(item?.complaints?.openCases ?? 0);
    const retaliationCases = Number(item?.complaints?.retaliationCases ?? 0);
    const surveyRate = Number(item?.surveyRate ?? 0);
    const domesticRate = Number(item?.domesticRate ?? 0);

    if (openCases > 0) reasons.push(`${openCases} denúncia(s) aberta(s)`);
    if (retaliationCases > 0) {
      reasons.push(`${retaliationCases} caso(s) com risco de retaliação`);
    }
    if (surveyRate >= 20) {
      reasons.push(`${surveyRate.toFixed(1)}% de sinal em pesquisa`);
    }
    if (domesticRate >= 15) {
      reasons.push(`${domesticRate.toFixed(1)}% em violência doméstica`);
    }

    return this.truncateText(reasons.join('; '), 220);
  }

  private truncateText(value: unknown, maxLength: number) {
    const text = String(value ?? '').trim();
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
  }

  private formatDateTimePtBr(input: string): string {
    const dt = new Date(input);
    if (Number.isNaN(dt.getTime())) {
      return new Date().toLocaleString('pt-BR');
    }
    return dt.toLocaleString('pt-BR');
  }

  private sseEvent(event: string, data: any): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  }

  private async gatherDataForType(
    type: AnalysisType,
    sources?: readonly AiKnowledgeSourceId[],
  ): Promise<any> {
    switch (type) {
      case 'executive': {
        const [dashboard, profile, text, geo] = await Promise.all([
          this.strategic.situationalDashboard(
            sources ? { sources: Array.from(sources) } : undefined,
          ),
          this.strategic.aggressorProfile(
            sources ? { sources: Array.from(sources) } : undefined,
          ),
          this.strategic.textAnalysis(
            sources ? { sources: Array.from(sources) } : undefined,
          ),
          this.strategic.geoMap(
            sources ? { sources: Array.from(sources) } : undefined,
          ),
        ]);
        return {
          dashboard,
          profile,
          textSummary: this.compactText(text),
          geoSummary: this.compactGeo(geo),
        };
      }
      case 'situational':
        return {
          dashboard: await this.strategic.situationalDashboard(
            sources ? { sources: Array.from(sources) } : undefined,
          ),
        };
      case 'aggressor':
        return {
          profile: await this.strategic.aggressorProfile(
            sources ? { sources: Array.from(sources) } : undefined,
          ),
        };
      case 'text':
        return {
          textSummary: this.compactText(
            await this.strategic.textAnalysis(
              sources ? { sources: Array.from(sources) } : undefined,
            ),
          ),
        };
      case 'geo':
        return {
          geoMap: await this.strategic.geoMap(
            sources ? { sources: Array.from(sources) } : undefined,
          ),
        };
      default:
        return {};
    }
  }

  private buildUserPrompt(
    type: AnalysisType,
    data: any,
    customPrompt?: string | null,
  ): string {
    let payloadJson = JSON.stringify(data);
    if (payloadJson.length > 28_000) {
      payloadJson = payloadJson.slice(0, 28_000) + '\n…(dados truncados)';
    }

    const defaultDescriptions: Record<AnalysisType, string> = {
      executive:
        'Redija um resumo executivo completo para o comando, abordando panorama situacional, perfil de denúncias, destaques textuais e distribuição geográfica.',
      situational:
        'Analise o panorama situacional: pesquisas, taxas de violência, denúncias ativas, atividades e missões.',
      aggressor:
        'Analise o perfil de assédio e violência: tipos de ocorrência, perfil do agressor e da vítima, relações hierárquicas e contextos.',
      text: 'Analise os padrões e tendências identificados nos textos livres do sistema: termos mais frequentes, temas recorrentes e insights.',
      geo: 'Analise a distribuição geográfica: estados com mais registros, concentração de denúncias, atividades e missões por região.',
    };

    const instruction = customPrompt?.trim() || defaultDescriptions[type];

    return (
      `${instruction}\n\n` +
      `IMPORTANTE: Responda diretamente com a análise final em português. ` +
      `NÃO inclua raciocínio intermediário, cálculos auxiliares ou pensamentos internos. ` +
      `Quando fizer afirmações analíticas, cite claramente a origem dos dados (ex.: pesquisa de recrutas, denúncias, relatórios, missões).\n\n` +
      `Dados JSON:\n${payloadJson}`
    );
  }

  private async appendTraceabilityReferences(
    type: AnalysisType,
    narrative: string,
    sources?: readonly AiKnowledgeSourceId[],
  ): Promise<string> {
    const base = this.normalizeReferenceLinks(String(narrative || '')).trim();
    if (!base) return base;
    if (/^##\s*refer[eê]ncias dos dados\b/im.test(base)) {
      return base;
    }

    let refs: AiSourceReference[] = [];
    try {
      refs = await this.strategic.aiSourceReferences(type, {
        sources: Array.isArray(sources) ? sources : undefined,
      });
    } catch {
      refs = [];
    }
    if (!refs.length) return base;

    const lines = refs.map((ref) => {
      const href = String(ref.href || '').trim();
      if (!href) return '';
      const label = String(ref.label || 'Referência').trim();
      const desc = String(ref.description || '').trim();
      return desc ? `- [${label}](${href}) — ${desc}` : `- [${label}](${href})`;
    });
    const filtered = lines.filter(Boolean);
    if (!filtered.length) return base;

    return `${base}\n\n## Referências dos Dados\n${filtered.join('\n')}`;
  }

  private normalizeReferenceLinks(text: string): string {
    let normalized = String(text || '');

    // Corrige aliases legados de rota de pesquisas.
    normalized = normalized
      .replace(
        /https?:\/\/cipavd\.ccabr\.intraer\/dashboard\/bi-survey\b/gi,
        '/dashboard/bi',
      )
      .replace(
        /https?:\/\/cipavd\.ccabr\.intraer\/dashboard\/bi-domestic-violence\b/gi,
        '/dashboard/bi-violencia-domestica',
      )
      .replace(/\/dashboard\/bi-survey\b/g, '/dashboard/bi')
      .replace(
        /\/dashboard\/bi-domestic-violence\b/g,
        '/dashboard/bi-violencia-domestica',
      );

    // Remove parâmetro espúrio de origem quando ele vier em links de atividades.
    normalized = normalized.replace(
      /(\/activities(?:-cipavd)?\?[^)\s\]]+)/g,
      (match) => this.stripQueryParam(match, 'itemSourceType'),
    );
    normalized = normalized.replace(
      /(https?:\/\/[^\s)\]]*\/activities(?:-cipavd)?\?[^)\s\]]+)/g,
      (match) => this.stripQueryParam(match, 'itemSourceType'),
    );

    return normalized;
  }

  private stripQueryParam(input: string, paramName: string): string {
    const raw = String(input || '').trim();
    if (!raw || !raw.includes('?')) return raw;
    const isAbsolute = /^https?:\/\//i.test(raw);

    try {
      const parsed = isAbsolute ? new URL(raw) : new URL(raw, 'https://local');
      parsed.searchParams.delete(paramName);
      const path =
        parsed.pathname + (parsed.search || '') + (parsed.hash || '');
      return isAbsolute ? parsed.toString() : path;
    } catch {
      return raw;
    }
  }

  private compactText(text: any) {
    const sources: Record<string, any> = {};
    if (text?.sources) {
      for (const [key, val] of Object.entries(
        text.sources as Record<string, any>,
      )) {
        if (val?.count > 0) {
          sources[key] = {
            count: val.count,
            topWords: (val.topWords ?? []).slice(0, 15),
          };
        }
      }
    }
    return {
      totalTexts: text?.consolidated?.totalTexts ?? 0,
      topWords: (text?.consolidated?.topWords ?? []).slice(0, 30),
      sources,
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
