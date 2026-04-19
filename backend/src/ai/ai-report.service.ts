import { Injectable, Logger } from '@nestjs/common';
import { ActivityScope, TaskStatus } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { Buffer } from 'node:buffer';
import { LitellmService } from '../llm/litellm.service';
import { MissionsService } from '../missions/missions.service';
import { PrismaService } from '../prisma/prisma.service';
import type { RbacUser } from '../rbac/rbac.types';
import { StrategicService } from '../strategic/strategic.service';
import { resolveBestOmByFabOm } from '../catalog/om-resolver';

export type AssistantReportKind = 'MISSION' | 'STRATEGIC' | 'OPERATIONAL';
export type AssistantReportTone = 'EXECUTIVE' | 'ANALYTICAL' | 'OPERATIONAL';
export type AssistantReportScope = 'SMIF' | 'CIPAVD' | 'CPCA' | 'COMGEP';
export type AssistantReportSectionId =
  | 'STRATEGIC_OVERVIEW'
  | 'MISSION_OVERVIEW'
  | 'MISSION_SCHEDULE'
  | 'ACTIVITIES'
  | 'TASKS'
  | 'CPCA_CASES'
  | 'SMIF_CASES'
  | 'SURVEY_INSTITUTIONAL'
  | 'SURVEY_DOMESTIC'
  | 'RECOMMENDATIONS';

export type AssistantReportChart = {
  id: string;
  title: string;
  subtitle?: string | null;
  labels: string[];
  values: number[];
  colorHex?: string | null;
};

export type AssistantReportTable = {
  id: string;
  title: string;
  columns: string[];
  rows: string[][];
  note?: string | null;
};

export type AssistantReportImage = {
  id: string;
  title: string;
  caption?: string | null;
  kind: 'mission_banner';
  missionId: string;
  bannerId: string;
};

export type AssistantGeneratedReportDraft = {
  title: string;
  subtitle: string;
  kind: AssistantReportKind;
  scope: AssistantReportScope;
  tone: AssistantReportTone;
  generatedAt: string;
  periodLabel: string;
  focusLabel?: string | null;
  executiveSummary: string;
  highlights: Array<{
    label: string;
    value: string;
    detail?: string | null;
  }>;
  sections: Array<{
    id: AssistantReportSectionId;
    title: string;
    body: string;
    bullets: string[];
    chartIds: string[];
    tableIds: string[];
    imageIds: string[];
  }>;
  charts: AssistantReportChart[];
  tables: AssistantReportTable[];
  images: AssistantReportImage[];
  recommendations: string[];
  dataNotes: string[];
};

type ReportGenerationInput = {
  kind: string;
  scope: string;
  title?: string | null;
  tone?: string | null;
  missionId?: string | null;
  focusLabel?: string | null;
  periodFrom?: string | null;
  periodTo?: string | null;
  includeCharts?: boolean | null;
  includeTables?: boolean | null;
  includeSystemImages?: boolean | null;
  sections?: string[] | null;
  reportInstructions?: string | null;
};

type ReportContext = {
  kind: AssistantReportKind;
  scope: AssistantReportScope;
  tone: AssistantReportTone;
  title: string;
  periodLabel: string;
  focusLabel: string | null;
  instructions: string | null;
  highlights: AssistantGeneratedReportDraft['highlights'];
  charts: AssistantReportChart[];
  tables: AssistantReportTable[];
  images: AssistantReportImage[];
  dataNotes: string[];
  sectionFacts: Record<
    AssistantReportSectionId,
    {
      title: string;
      facts: string[];
      chartIds: string[];
      tableIds: string[];
      imageIds: string[];
    }
  >;
  selectedSections: AssistantReportSectionId[];
};

const REPORT_SECTION_LABELS: Record<AssistantReportSectionId, string> = {
  STRATEGIC_OVERVIEW: 'Panorama estratégico',
  MISSION_OVERVIEW: 'Visão da missão',
  MISSION_SCHEDULE: 'Cronograma da missão',
  ACTIVITIES: 'Atividades executadas',
  TASKS: 'Tarefas e pendências',
  CPCA_CASES: 'Denúncias CPCA',
  SMIF_CASES: 'Denúncias SMIF',
  SURVEY_INSTITUTIONAL: 'Pesquisa institucional',
  SURVEY_DOMESTIC: 'Pesquisa de violência doméstica',
  RECOMMENDATIONS: 'Recomendações',
};

const REPORT_SECTION_DESCRIPTION: Record<AssistantReportSectionId, string> = {
  STRATEGIC_OVERVIEW:
    'Cruza riscos, atuação, cobertura e prioridades executivas.',
  MISSION_OVERVIEW:
    'Consolida os dados principais da missão e o contexto atendido.',
  MISSION_SCHEDULE: 'Mostra o cronograma consolidado da missão.',
  ACTIVITIES:
    'Detalha as atividades de campo executadas e seus registros associados.',
  TASKS: 'Resume tarefas abertas, vencidas e concluídas relacionadas ao recorte.',
  CPCA_CASES:
    'Apresenta volume, status e sinais principais das denúncias CPCA.',
  SMIF_CASES:
    'Apresenta volume, status e ocorrências registradas no fluxo SMIF.',
  SURVEY_INSTITUTIONAL:
    'Resume respostas da pesquisa institucional ligadas ao recorte.',
  SURVEY_DOMESTIC:
    'Resume sinais da pesquisa de violência doméstica ligados ao recorte.',
  RECOMMENDATIONS:
    'Traduz os sinais do sistema em encaminhamentos concretos para atuação.',
};

const PAGE_MARGIN = 42;
const PAGE_WIDTH = 595.28 - PAGE_MARGIN * 2;
const PAGE_HEIGHT = 841.89 - PAGE_MARGIN * 2;

@Injectable()
export class AiReportService {
  private readonly logger = new Logger(AiReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly litellm: LitellmService,
    private readonly missions: MissionsService,
    private readonly strategic: StrategicService,
  ) {}

  async buildDraft(
    input: ReportGenerationInput,
    user?: RbacUser,
  ): Promise<AssistantGeneratedReportDraft> {
    const context = await this.buildContext(input, user);
    const fallback = this.buildFallbackDraft(context);
    const llmDraft = await this.generateDraftViaLlm(context).catch((error) => {
      this.logger.warn(
        `Falha ao gerar relatório via LLM: ${this.extractErrorMessage(error)}`,
      );
      return null;
    });
    return llmDraft ? this.mergeDraftWithContext(llmDraft, context, fallback) : fallback;
  }

  async reviseDraft(
    input: ReportGenerationInput,
    currentDraft: AssistantGeneratedReportDraft,
    instruction: string,
    user?: RbacUser,
  ): Promise<AssistantGeneratedReportDraft> {
    const context = await this.buildContext(input, user);
    const fallback = {
      ...this.buildFallbackDraft(context),
      title: currentDraft.title,
      subtitle: currentDraft.subtitle,
    };

    try {
      const response = await this.litellm.chatCompletion({
        temperature: 0.25,
        max_tokens: 2600,
        messages: [
          {
            role: 'system',
            content: [
              'Você revisa relatórios institucionais do COMAER.',
              'Ajuste título, subtítulo, resumo executivo, texto das seções, ordem das seções e os ativos visuais usados.',
              'Nunca invente dados, percentuais, nomes, casos, atividades ou gráficos fora do contexto factual disponível.',
              'Responda apenas em JSON válido.',
            ].join(' '),
          },
          {
            role: 'user',
            content: [
              'Instrução do usuário:',
              instruction.trim(),
              '',
              'Rascunho atual:',
              JSON.stringify(currentDraft, null, 2),
              '',
              'Contexto factual e ativos disponíveis:',
              JSON.stringify(this.buildLlmContextPayload(context), null, 2),
              '',
              'Saída esperada em JSON:',
              JSON.stringify(
                {
                  title: 'string',
                  subtitle: 'string',
                  executiveSummary: 'string',
                  sections: [
                    {
                      id: 'STRATEGIC_OVERVIEW',
                      title: 'string',
                      body: 'string',
                      bullets: ['string'],
                      chartIds: ['string'],
                      tableIds: ['string'],
                      imageIds: ['string'],
                    },
                  ],
                  recommendations: ['string'],
                  dataNotes: ['string'],
                },
                null,
                2,
              ),
            ].join('\n'),
          },
        ],
      });
      const parsed = this.parseLlmDraft(response.content, context);
      if (parsed) {
        return this.mergeDraftWithContext(parsed, context, fallback);
      }
    } catch (error) {
      this.logger.warn(
        `Falha ao revisar relatório via LLM: ${this.extractErrorMessage(error)}`,
      );
    }

    return {
      ...fallback,
      executiveSummary: currentDraft.executiveSummary,
      sections: currentDraft.sections,
      recommendations: currentDraft.recommendations,
      dataNotes: currentDraft.dataNotes,
    };
  }

  async renderPdf(
    draft: AssistantGeneratedReportDraft,
    user?: RbacUser,
  ): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      margin: PAGE_MARGIN,
      info: {
        Title: draft.title,
        Author: 'Sistema CIPAVD/SMIF',
        Subject: 'Relatório personalizado gerado pelo assistente virtual',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    const endPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    this.drawCover(doc, draft);
    this.drawHighlights(doc, draft);
    this.drawExecutiveSummary(doc, draft);

    const chartsById = new Map(draft.charts.map((item) => [item.id, item]));
    const tablesById = new Map(draft.tables.map((item) => [item.id, item]));
    const imagesById = new Map(draft.images.map((item) => [item.id, item]));

    for (const section of draft.sections) {
      this.ensureVerticalSpace(doc, 120);
      this.drawSectionHeader(doc, section.title);
      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor('#102C57')
        .text(section.body || '—', {
          width: PAGE_WIDTH,
          align: 'left',
          lineGap: 3,
        });
      if (section.bullets.length) {
        doc.moveDown(0.4);
        for (const bullet of section.bullets) {
          this.ensureVerticalSpace(doc, 26);
          doc
            .font('Helvetica')
            .fontSize(10.5)
            .fillColor('#243B53')
            .text(`• ${bullet}`, {
              width: PAGE_WIDTH,
              indent: 8,
              lineGap: 2,
            });
        }
      }

      for (const imageId of section.imageIds) {
        const image = imagesById.get(imageId);
        if (!image) continue;
        const imageBuffer = await this.resolveImageBuffer(image, user).catch(() => null);
        if (!imageBuffer) continue;
        this.ensureVerticalSpace(doc, 220);
        doc.moveDown(0.6);
        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor('#1A3C6E')
          .text(image.title, { width: PAGE_WIDTH });
        doc.moveDown(0.2);
        const fitWidth = PAGE_WIDTH;
        doc.image(imageBuffer, PAGE_MARGIN, doc.y, {
          fit: [fitWidth, 200],
          align: 'center',
        });
        doc.moveDown(10);
        if (image.caption) {
          doc
            .font('Helvetica')
            .fontSize(9)
            .fillColor('#52606D')
            .text(image.caption, {
              width: PAGE_WIDTH,
              align: 'center',
            });
        }
        doc.moveDown(0.8);
      }

      for (const chartId of section.chartIds) {
        const chart = chartsById.get(chartId);
        if (!chart) continue;
        this.ensureVerticalSpace(doc, 180);
        doc.moveDown(0.6);
        this.drawBarChart(doc, chart);
        doc.moveDown(0.8);
      }

      for (const tableId of section.tableIds) {
        const table = tablesById.get(tableId);
        if (!table) continue;
        this.drawTable(doc, table);
        doc.moveDown(0.8);
      }
    }

    if (draft.recommendations.length || draft.dataNotes.length) {
      this.ensureVerticalSpace(doc, 160);
      this.drawSectionHeader(doc, 'Fechamento');
      if (draft.recommendations.length) {
        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor('#1A3C6E')
          .text('Recomendações');
        doc.moveDown(0.3);
        for (const item of draft.recommendations) {
          doc
            .font('Helvetica')
            .fontSize(10.5)
            .fillColor('#243B53')
            .text(`• ${item}`, {
              width: PAGE_WIDTH,
              indent: 8,
              lineGap: 2,
            });
        }
      }
      if (draft.dataNotes.length) {
        doc.moveDown(0.8);
        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor('#1A3C6E')
          .text('Observações sobre a base');
        doc.moveDown(0.3);
        for (const note of draft.dataNotes) {
          doc
            .font('Helvetica')
            .fontSize(10)
            .fillColor('#52606D')
            .text(`• ${note}`, {
              width: PAGE_WIDTH,
              indent: 8,
              lineGap: 2,
            });
        }
      }
    }

    doc.end();
    return endPromise;
  }

  buildFileName(draft: AssistantGeneratedReportDraft) {
    const base = draft.title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
    return `${base || 'relatorio-ai'}-${draft.generatedAt.slice(0, 10)}.pdf`;
  }

  private async buildContext(
    input: ReportGenerationInput,
    user?: RbacUser,
  ): Promise<ReportContext> {
    const kind = this.normalizeKind(input.kind);
    const scope = this.normalizeScope(input.scope, kind);
    const tone = this.normalizeTone(input.tone);
    const title = this.normalizeTitle(input.title, kind, scope);
    const focusLabel = this.normalizeOptionalText(input.focusLabel);
    const instructions = this.normalizeOptionalText(input.reportInstructions);
    const period = this.normalizePeriod(input.periodFrom, input.periodTo);
    const selectedSections = this.normalizeSections(input.sections, kind);
    const includeCharts = input.includeCharts !== false;
    const includeTables = input.includeTables !== false;
    const includeSystemImages = input.includeSystemImages === true;
    const dataNotes: string[] = [];
    const charts: AssistantReportChart[] = [];
    const tables: AssistantReportTable[] = [];
    const images: AssistantReportImage[] = [];
    const highlights: AssistantGeneratedReportDraft['highlights'] = [];

    const sectionFacts = this.createEmptySectionFacts();

    const focusOm = focusLabel
      ? await resolveBestOmByFabOm(this.prisma, focusLabel).catch(() => null)
      : null;
    const focusUf = this.normalizeUf(focusLabel);
    const focusLocality = await this.resolveFocusLocality(scope, focusLabel);
    const focusLabelResolved =
      focusOm?.code ??
      focusLocality?.code ??
      focusUf ??
      focusLabel ??
      null;

    if (kind === 'MISSION') {
      const mission = await this.missions.getById(String(input.missionId ?? ''), user);
      const missionScope =
        mission.scope === ActivityScope.CIPAVD ? 'CIPAVD' : 'SMIF';
      const missionLocalityMeta = mission.localityId
        ? await this.prisma.locality.findUnique({
            where: { id: mission.localityId },
            select: { uf: true },
          })
        : null;
      const activityRows = await this.prisma.activity.findMany({
        where: {
          localityId: mission.localityId,
          scope: mission.scope,
          eventDate: {
            gte: mission.startDate,
            lte: mission.endDate,
          },
        },
        include: {
          activityType: { select: { name: true } },
          report: {
            select: {
              id: true,
              signedAt: true,
              mainPointsObserved: true,
              attentionPoints: true,
              conclusion: true,
            },
          },
        },
        orderBy: [{ eventDate: 'asc' }, { createdAt: 'asc' }],
      });
      const taskRows = await this.prisma.taskInstance.findMany({
        where: {
          scope: mission.scope,
          localityId: mission.localityId,
          dueDate: {
            gte: new Date(mission.startDate.getTime() - 14 * 24 * 60 * 60 * 1000),
            lte: new Date(mission.endDate.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        },
        include: {
          locality: { select: { code: true, name: true } },
          taskTemplate: { select: { title: true } },
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        take: 20,
      });
      const cpcaCases = await this.prisma.cpcComplaintCase.findMany({
        where: {
          OR: [
            focusLocality?.id ? { localityId: focusLocality.id } : undefined,
            missionLocalityMeta?.uf
              ? { om: { uf: missionLocalityMeta.uf } }
              : undefined,
          ].filter(Boolean) as any[],
        },
        select: {
          caseNumber: true,
          workflowScope: true,
          complaintType: true,
          status: true,
          retaliationRisk: true,
          reportedAt: true,
          om: { select: { code: true, name: true, uf: true } },
          locality: { select: { code: true, name: true, uf: true } },
        },
        orderBy: [{ reportedAt: 'desc' }],
        take: 12,
      });
      const smifCases = await this.prisma.smifComplaint.findMany({
        where: { localityId: mission.localityId },
        select: {
          id: true,
          status: true,
          reportedAt: true,
          description: true,
          locality: { select: { code: true, name: true, uf: true } },
        },
        orderBy: [{ reportedAt: 'desc' }],
        take: 12,
      });

      const missionDays = this.calculateInclusiveDays(mission.startDate, mission.endDate);
      const signedReports = activityRows.filter((item) => Boolean(item.report?.signedAt)).length;
      highlights.push(
        {
          label: 'Missão',
          value: mission.title,
          detail: `${mission.locality.code ?? mission.locality.name} • ${missionScope}`,
        },
        {
          label: 'Dias',
          value: String(missionDays),
          detail: `${this.formatDate(mission.startDate)} a ${this.formatDate(mission.endDate)}`,
        },
        {
          label: 'Atividades executadas',
          value: String(activityRows.length),
          detail: signedReports
            ? `${signedReports} com relatório assinado`
            : 'Sem relatório assinado no período',
        },
        {
          label: 'Participantes',
          value: String(mission.participants.length),
          detail: `${mission.scheduleItems.length} item(ns) no cronograma`,
        },
      );

      sectionFacts.MISSION_OVERVIEW = {
        title: REPORT_SECTION_LABELS.MISSION_OVERVIEW,
        facts: [
          `Missão ${mission.title} no escopo ${missionScope}.`,
          `Localidade principal: ${mission.locality.code ?? mission.locality.name}.`,
          `Período: ${this.formatDate(mission.startDate)} a ${this.formatDate(mission.endDate)} (${missionDays} dia(s)).`,
          `${mission.participants.length} participante(s) cadastrado(s).`,
          `${mission.scheduleItems.length} item(ns) no cronograma.`,
          mission.description ? `Descrição oficial: ${mission.description}` : '',
        ].filter(Boolean),
        chartIds: [],
        tableIds: [],
        imageIds: [],
      };

      sectionFacts.MISSION_SCHEDULE = {
        title: REPORT_SECTION_LABELS.MISSION_SCHEDULE,
        facts: [
          mission.scheduleItems.length
            ? `Cronograma com ${mission.scheduleItems.length} item(ns) distribuídos ao longo da missão.`
            : 'A missão não possui cronograma salvo.',
        ],
        chartIds: [],
        tableIds: [],
        imageIds: [],
      };

      sectionFacts.ACTIVITIES = {
        title: REPORT_SECTION_LABELS.ACTIVITIES,
        facts: [
          activityRows.length
            ? `${activityRows.length} atividade(s) localizada(s) no período da missão.`
            : 'Nenhuma atividade de campo foi localizada no período da missão.',
          signedReports
            ? `${signedReports} atividade(s) contam com relatório assinado.`
            : 'Nenhuma atividade com relatório assinado foi localizada.',
        ],
        chartIds: [],
        tableIds: [],
        imageIds: [],
      };

      sectionFacts.TASKS = {
        title: REPORT_SECTION_LABELS.TASKS,
        facts: [
          taskRows.length
            ? `${taskRows.length} tarefa(s) relacionadas ao mesmo recorte operacional foram encontradas.`
            : 'Nenhuma tarefa relacionada ao recorte foi encontrada.',
          taskRows.filter((item) => item.status !== TaskStatus.DONE).length
            ? `${taskRows.filter((item) => item.status !== TaskStatus.DONE).length} tarefa(s) ainda estão pendentes.`
            : 'Todas as tarefas localizadas estão concluídas.',
        ],
        chartIds: [],
        tableIds: [],
        imageIds: [],
      };

      sectionFacts.CPCA_CASES = {
        title: REPORT_SECTION_LABELS.CPCA_CASES,
        facts: [
          cpcaCases.length
            ? `${cpcaCases.length} denúncia(s) CPCA/SMIF foram localizadas no mesmo recorte geográfico.`
            : 'Nenhuma denúncia CPCA/SMIF foi localizada no recorte desta missão.',
          cpcaCases.filter((item) => item.retaliationRisk).length
            ? `${cpcaCases.filter((item) => item.retaliationRisk).length} caso(s) com risco de retaliação marcado.`
            : '',
        ].filter(Boolean),
        chartIds: [],
        tableIds: [],
        imageIds: [],
      };

      sectionFacts.SMIF_CASES = {
        title: REPORT_SECTION_LABELS.SMIF_CASES,
        facts: [
          smifCases.length
            ? `${smifCases.length} denúncia(s) SMIF foram localizadas para a localidade da missão.`
            : 'Nenhuma denúncia SMIF foi localizada para a localidade da missão.',
        ],
        chartIds: [],
        tableIds: [],
        imageIds: [],
      };

      if (includeTables && mission.scheduleItems.length) {
        const tableId = 'mission_schedule_table';
        tables.push({
          id: tableId,
          title: 'Cronograma consolidado',
          columns: ['Início', 'Atividade', 'Duração', 'Local'],
          rows: mission.scheduleItems.slice(0, 20).map((item) => [
            this.formatDateTime(item.startAt),
            item.title,
            `${item.durationMinutes} min`,
            item.location || '-',
          ]),
          note:
            mission.scheduleItems.length > 20
              ? `Mostrando 20 de ${mission.scheduleItems.length} itens do cronograma.`
              : null,
        });
        sectionFacts.MISSION_SCHEDULE.tableIds.push(tableId);
      }

      if (includeTables && activityRows.length) {
        const tableId = 'mission_activities_table';
        tables.push({
          id: tableId,
          title: 'Atividades executadas no período',
          columns: ['Data', 'Título', 'Tipo', 'Status do relatório'],
          rows: activityRows.slice(0, 20).map((item) => [
            this.formatDate(item.eventDate),
            item.title,
            item.activityType?.name ?? 'Não informado',
            item.report?.signedAt ? 'Assinado' : item.report?.id ? 'Rascunho' : 'Sem relatório',
          ]),
          note:
            activityRows.length > 20
              ? `Mostrando 20 de ${activityRows.length} atividades.`
              : null,
        });
        sectionFacts.ACTIVITIES.tableIds.push(tableId);
      }

      if (includeCharts && activityRows.length) {
        const byType = this.countByLabel(
          activityRows.map((item) => item.activityType?.name ?? 'Não informado'),
        );
        const chart = this.createChartFromCounts(
          'mission_activities_by_type',
          'Atividades por tipo',
          byType,
          '#1A73E8',
        );
        if (chart) {
          charts.push(chart);
          sectionFacts.ACTIVITIES.chartIds.push(chart.id);
        }
      }

      if (includeCharts && taskRows.length) {
        const byStatus = this.countByLabel(
          taskRows.map((item) => this.translateTaskStatus(item.status)),
        );
        const chart = this.createChartFromCounts(
          'mission_tasks_by_status',
          'Tarefas por status',
          byStatus,
          '#EF6C00',
        );
        if (chart) {
          charts.push(chart);
          sectionFacts.TASKS.chartIds.push(chart.id);
        }
      }

      if (includeTables && cpcaCases.length) {
        const tableId = 'mission_cpca_cases_table';
        tables.push({
          id: tableId,
          title: 'Casos CPCA/SMIF relacionados ao recorte',
          columns: ['Caso', 'Fluxo', 'Tipo', 'Status', 'OM/Localidade'],
          rows: cpcaCases.slice(0, 15).map((item) => [
            item.caseNumber,
            String(item.workflowScope),
            item.complaintType,
            this.translateComplaintStatus(item.status),
            item.om?.code ?? item.locality?.code ?? item.locality?.name ?? '-',
          ]),
          note:
            cpcaCases.length > 15
              ? `Mostrando 15 de ${cpcaCases.length} casos localizados.`
              : null,
        });
        sectionFacts.CPCA_CASES.tableIds.push(tableId);
      }

      if (includeTables && smifCases.length) {
        const tableId = 'mission_smif_cases_table';
        tables.push({
          id: tableId,
          title: 'Casos SMIF da localidade',
          columns: ['Data', 'Status', 'Localidade', 'Descrição'],
          rows: smifCases.slice(0, 10).map((item) => [
            this.formatDate(item.reportedAt),
            item.status === 'COMPLETED' ? 'Concluída' : 'Em andamento',
            item.locality.code ?? item.locality.name,
            this.clampText(item.description, 90),
          ]),
          note:
            smifCases.length > 10
              ? `Mostrando 10 de ${smifCases.length} casos SMIF.`
              : null,
        });
        sectionFacts.SMIF_CASES.tableIds.push(tableId);
      }

      if (includeSystemImages && mission.banners.length) {
        const firstBanner = mission.banners[0];
        const imageId = 'mission_banner_primary';
        images.push({
          id: imageId,
          title: `Banner da missão: ${firstBanner.name}`,
          caption:
            `${firstBanner.eventDate} • ${firstBanner.eventTime} • ${firstBanner.locationPrimary}` +
            (firstBanner.locationSecondary ? ` / ${firstBanner.locationSecondary}` : ''),
          kind: 'mission_banner',
          missionId: mission.id,
          bannerId: firstBanner.id,
        });
        sectionFacts.MISSION_OVERVIEW.imageIds.push(imageId);
      } else if (includeSystemImages) {
        dataNotes.push(
          'O usuário solicitou imagens do sistema, mas a missão não possui banner cadastrado.',
        );
      }

      dataNotes.push(
        `Relatório focado na missão ${mission.title} (${missionScope}).`,
      );
      return {
        kind,
        scope: missionScope as AssistantReportScope,
        tone,
        title,
        periodLabel:
          period.label ||
          `${this.formatDate(mission.startDate)} a ${this.formatDate(mission.endDate)}`,
        focusLabel: focusLabelResolved,
        instructions,
        highlights,
        charts,
        tables,
        images,
        dataNotes,
        sectionFacts,
        selectedSections,
      };
    }

    const [
      situational,
      comgepRoom,
      surveyRows,
      domesticRows,
      cpcaCases,
      smifCases,
      missions,
      activities,
      tasks,
    ] = await Promise.all([
      this.strategic.situationalDashboard(),
      this.strategic.comgepSituationRoom(),
      this.prisma.biSurveyResponse.findMany({
        where: this.buildSurveyWhere(period, focusOm?.code ?? null),
        select: {
          sufferedViolence: true,
          violenceTypes: true,
          om: true,
          submittedAt: true,
        },
      }),
      this.prisma.biDomesticViolenceResponse.findMany({
        where: this.buildDomesticWhere(period, focusOm?.code ?? null),
        select: {
          organization: true,
          sufferedLifetime: true,
          sufferedLast12Months: true,
          violenceTypes: true,
          authorMilitaryLink: true,
          submittedAt: true,
        },
      }),
      (this.prisma as any).cpcComplaintCase.findMany({
        where: this.buildCpcaWhere(scope, period, focusOm?.id ?? null, focusUf, focusLocality?.id ?? null),
        select: {
          caseNumber: true,
          workflowScope: true,
          complaintType: true,
          status: true,
          retaliationRisk: true,
          reportedAt: true,
          om: { select: { code: true, name: true, uf: true } },
          locality: { select: { code: true, name: true, uf: true } },
        },
        orderBy: [{ reportedAt: 'desc' }],
        take: 30,
      }),
      this.prisma.smifComplaint.findMany({
        where: this.buildSmifWhere(period, focusUf, focusLocality?.id ?? null),
        select: {
          id: true,
          reportedAt: true,
          status: true,
          description: true,
          locality: { select: { code: true, name: true, uf: true } },
        },
        orderBy: [{ reportedAt: 'desc' }],
        take: 30,
      }),
      this.prisma.mission.findMany({
        where: this.buildMissionWhere(scope, period, focusUf, focusLocality?.id ?? null),
        select: {
          id: true,
          title: true,
          scope: true,
          startDate: true,
          endDate: true,
          locality: { select: { code: true, name: true, uf: true } },
        },
        orderBy: [{ startDate: 'desc' }],
        take: 30,
      }),
      this.prisma.activity.findMany({
        where: this.buildActivityWhere(scope, period, focusUf, focusLocality?.id ?? null),
        select: {
          id: true,
          title: true,
          scope: true,
          status: true,
          eventDate: true,
          activityType: { select: { name: true } },
          locality: { select: { code: true, name: true, uf: true } },
          report: { select: { id: true, signedAt: true } },
        },
        orderBy: [{ eventDate: 'desc' }],
        take: 40,
      }),
      this.prisma.taskInstance.findMany({
        where: this.buildTaskWhere(scope, period, focusUf, focusLocality?.id ?? null),
        select: {
          id: true,
          titleOverride: true,
          status: true,
          dueDate: true,
          priority: true,
          scope: true,
          locality: { select: { code: true, name: true, uf: true } },
          taskTemplate: { select: { title: true } },
        },
        orderBy: [{ dueDate: 'asc' }],
        take: 40,
      }),
    ]);

    const totalCpca = cpcaCases.length;
    const openCpca = cpcaCases.filter((item: any) => !['CONCLUDED', 'ARCHIVED'].includes(String(item.status))).length;
    const totalSmif = smifCases.length;
    const openSmif = smifCases.filter((item: any) => String(item.status) !== 'COMPLETED').length;
    const signedReports = activities.filter((item: any) => Boolean(item.report?.signedAt)).length;
    const surveyYes = surveyRows.filter((item: any) => item.sufferedViolence === true).length;
    const surveyRate = surveyRows.length ? Number(((surveyYes / surveyRows.length) * 100).toFixed(1)) : 0;
    const domesticLast12 = domesticRows.filter((item: any) => item.sufferedLast12Months === true).length;
    const domesticLast12Rate = domesticRows.length
      ? Number(((domesticLast12 / domesticRows.length) * 100).toFixed(1))
      : 0;

    highlights.push(
      {
        label: 'Missões',
        value: String(missions.length),
        detail: focusLabelResolved ? `Recorte ${focusLabelResolved}` : 'Recorte consolidado',
      },
      {
        label: 'Atividades',
        value: String(activities.length),
        detail: signedReports
          ? `${signedReports} com relatório assinado`
          : 'Sem relatório assinado no recorte',
      },
      {
        label: 'Casos CPCA/SMIF',
        value: String(totalCpca + totalSmif),
        detail: `${openCpca + openSmif} ainda em aberto`,
      },
      {
        label: 'Pesquisa institucional',
        value: `${surveyRate}%`,
        detail: `${surveyRows.length} resposta(s) no recorte`,
      },
    );

    sectionFacts.STRATEGIC_OVERVIEW = {
      title: REPORT_SECTION_LABELS.STRATEGIC_OVERVIEW,
      facts: [
        `Painel situacional indica ${situational.localityCount} localidade(s) catalogada(s).`,
        `${situational.complaints.totalCases} denúncia(s) formal(is) no consolidado estratégico.`,
        `Sala COMGEP aponta ${comgepRoom.summary.criticalUfCount} UF(s) crítica(s) e ${comgepRoom.summary.highRiskOmCount} OM(s) de alto risco.`,
        focusLabelResolved ? `Recorte solicitado: ${focusLabelResolved}.` : '',
      ].filter(Boolean),
      chartIds: [],
      tableIds: [],
      imageIds: [],
    };
    sectionFacts.SURVEY_INSTITUTIONAL = {
      title: REPORT_SECTION_LABELS.SURVEY_INSTITUTIONAL,
      facts: [
        `${surveyRows.length} resposta(s) da pesquisa institucional no recorte.`,
        `${surveyYes} resposta(s) indicaram violência, taxa de ${surveyRate}%.`,
        this.describeTopArrayValues(
          surveyRows.flatMap((item: any) => item.violenceTypes ?? []),
          'Tipos mais citados',
        ),
      ].filter(Boolean),
      chartIds: [],
      tableIds: [],
      imageIds: [],
    };
    sectionFacts.SURVEY_DOMESTIC = {
      title: REPORT_SECTION_LABELS.SURVEY_DOMESTIC,
      facts: [
        `${domesticRows.length} resposta(s) de violência doméstica no recorte.`,
        `${domesticLast12} resposta(s) relataram violência nos últimos 12 meses, taxa de ${domesticLast12Rate}%.`,
        `${domesticRows.filter((item: any) => this.hasMilitaryLink(item.authorMilitaryLink)).length} relato(s) indicam autor com vínculo militar.`,
      ],
      chartIds: [],
      tableIds: [],
      imageIds: [],
    };
    sectionFacts.CPCA_CASES = {
      title: REPORT_SECTION_LABELS.CPCA_CASES,
      facts: [
        `${totalCpca} caso(s) CPCA/SMIF foram localizados no recorte.`,
        `${openCpca} caso(s) seguem em aberto.`,
        `${cpcaCases.filter((item: any) => item.retaliationRisk).length} caso(s) estão marcados com risco de retaliação.`,
      ],
      chartIds: [],
      tableIds: [],
      imageIds: [],
    };
    sectionFacts.SMIF_CASES = {
      title: REPORT_SECTION_LABELS.SMIF_CASES,
      facts: [
        `${totalSmif} caso(s) do fluxo SMIF foram localizados.`,
        `${openSmif} caso(s) SMIF seguem em andamento.`,
      ],
      chartIds: [],
      tableIds: [],
      imageIds: [],
    };
    sectionFacts.ACTIVITIES = {
      title: REPORT_SECTION_LABELS.ACTIVITIES,
      facts: [
        `${activities.length} atividade(s) no recorte, sendo ${signedReports} com relatório assinado.`,
        this.describeTopArrayValues(
          activities.map((item: any) => item.activityType?.name ?? 'Não informado'),
          'Tipos de atividade mais frequentes',
        ),
      ].filter(Boolean),
      chartIds: [],
      tableIds: [],
      imageIds: [],
    };
    sectionFacts.MISSION_OVERVIEW = {
      title: REPORT_SECTION_LABELS.MISSION_OVERVIEW,
      facts: [
        `${missions.length} missão(ões) localizada(s) no recorte.`,
        missions.length
          ? `Mais recente: ${missions[0].title} (${this.formatDate(missions[0].startDate)} a ${this.formatDate(missions[0].endDate)}).`
          : 'Nenhuma missão foi localizada no recorte.',
      ],
      chartIds: [],
      tableIds: [],
      imageIds: [],
    };
    sectionFacts.TASKS = {
      title: REPORT_SECTION_LABELS.TASKS,
      facts: [
        `${tasks.length} tarefa(s) no recorte.`,
        `${tasks.filter((item: any) => item.status !== TaskStatus.DONE).length} tarefa(s) ainda pendentes.`,
        `${tasks.filter((item: any) => item.status === TaskStatus.BLOCKED).length} tarefa(s) bloqueadas.`,
      ],
      chartIds: [],
      tableIds: [],
      imageIds: [],
    };
    sectionFacts.RECOMMENDATIONS = {
      title: REPORT_SECTION_LABELS.RECOMMENDATIONS,
      facts: [
        'As recomendações devem refletir o cruzamento entre pesquisas, denúncias e presença operacional.',
      ],
      chartIds: [],
      tableIds: [],
      imageIds: [],
    };

    if (includeCharts) {
      const complaintStatusCounts = this.countByLabel(
        cpcaCases.map((item: any) => this.translateComplaintStatus(item.status)),
      );
      const complaintChart = this.createChartFromCounts(
        'cpca_status_chart',
        'Denúncias CPCA/SMIF por status',
        complaintStatusCounts,
        '#D32F2F',
      );
      if (complaintChart) {
        charts.push(complaintChart);
        sectionFacts.CPCA_CASES.chartIds.push(complaintChart.id);
      }

      const taskChart = this.createChartFromCounts(
        'tasks_status_chart',
        'Tarefas por status',
        this.countByLabel(tasks.map((item: any) => this.translateTaskStatus(item.status))),
        '#ED6C02',
      );
      if (taskChart) {
        charts.push(taskChart);
        sectionFacts.TASKS.chartIds.push(taskChart.id);
      }

      const activityChart = this.createChartFromCounts(
        'activities_type_chart',
        'Atividades por tipo',
        this.countByLabel(
          activities.map((item: any) => item.activityType?.name ?? 'Não informado'),
        ),
        '#1A73E8',
      );
      if (activityChart) {
        charts.push(activityChart);
        sectionFacts.ACTIVITIES.chartIds.push(activityChart.id);
      }

      const surveyChart = this.createChartFromCounts(
        'survey_yes_no_chart',
        'Pesquisa institucional — Sim/Não',
        new Map([
          ['Sim', surveyYes],
          ['Demais', Math.max(surveyRows.length - surveyYes, 0)],
        ]),
        '#7B1FA2',
      );
      if (surveyChart) {
        charts.push(surveyChart);
        sectionFacts.SURVEY_INSTITUTIONAL.chartIds.push(surveyChart.id);
      }

      const domesticChart = this.createChartFromCounts(
        'domestic_last12_chart',
        'Violência doméstica — últimos 12 meses',
        new Map([
          ['Sim', domesticLast12],
          ['Demais', Math.max(domesticRows.length - domesticLast12, 0)],
        ]),
        '#8E244D',
      );
      if (domesticChart) {
        charts.push(domesticChart);
        sectionFacts.SURVEY_DOMESTIC.chartIds.push(domesticChart.id);
      }

      const omRiskChart = this.createChartFromPairs(
        'comgep_top_oms_chart',
        'OMs de maior risco',
        (comgepRoom.details?.omRiskIndex ?? []).slice(0, 6).map((item: any) => ({
          label: String(item.code ?? item.name ?? 'OM'),
          value: Number(item.riskScore ?? 0),
        })),
        '#C62828',
      );
      if (omRiskChart) {
        charts.push(omRiskChart);
        sectionFacts.STRATEGIC_OVERVIEW.chartIds.push(omRiskChart.id);
      }
    }

    if (includeTables) {
      if (cpcaCases.length) {
        const tableId = 'cpca_cases_table';
        tables.push({
          id: tableId,
          title: 'Casos CPCA/SMIF recentes',
          columns: ['Caso', 'Fluxo', 'Tipo', 'Status', 'OM/Localidade'],
          rows: cpcaCases.slice(0, 15).map((item: any) => [
            item.caseNumber,
            String(item.workflowScope),
            item.complaintType,
            this.translateComplaintStatus(item.status),
            item.om?.code ?? item.locality?.code ?? item.locality?.name ?? '-',
          ]),
          note: cpcaCases.length > 15 ? `Mostrando 15 de ${cpcaCases.length} casos.` : null,
        });
        sectionFacts.CPCA_CASES.tableIds.push(tableId);
      }

      if (smifCases.length) {
        const tableId = 'smif_cases_table';
        tables.push({
          id: tableId,
          title: 'Casos SMIF recentes',
          columns: ['Data', 'Status', 'Localidade', 'Descrição'],
          rows: smifCases.slice(0, 12).map((item: any) => [
            this.formatDate(item.reportedAt),
            item.status === 'COMPLETED' ? 'Concluída' : 'Em andamento',
            item.locality.code ?? item.locality.name,
            this.clampText(item.description, 85),
          ]),
          note: smifCases.length > 12 ? `Mostrando 12 de ${smifCases.length} casos.` : null,
        });
        sectionFacts.SMIF_CASES.tableIds.push(tableId);
      }

      if (missions.length) {
        const tableId = 'missions_table';
        tables.push({
          id: tableId,
          title: 'Missões no recorte',
          columns: ['Missão', 'Escopo', 'Período', 'Localidade'],
          rows: missions.slice(0, 12).map((item: any) => [
            item.title,
            item.scope,
            `${this.formatDate(item.startDate)} a ${this.formatDate(item.endDate)}`,
            item.locality.code ?? item.locality.name,
          ]),
          note: missions.length > 12 ? `Mostrando 12 de ${missions.length} missões.` : null,
        });
        sectionFacts.MISSION_OVERVIEW.tableIds.push(tableId);
      }

      if (activities.length) {
        const tableId = 'activities_table';
        tables.push({
          id: tableId,
          title: 'Atividades no recorte',
          columns: ['Data', 'Título', 'Tipo', 'Relatório'],
          rows: activities.slice(0, 15).map((item: any) => [
            this.formatDate(item.eventDate),
            item.title,
            item.activityType?.name ?? 'Não informado',
            item.report?.signedAt ? 'Assinado' : item.report?.id ? 'Rascunho' : 'Sem relatório',
          ]),
          note: activities.length > 15 ? `Mostrando 15 de ${activities.length} atividades.` : null,
        });
        sectionFacts.ACTIVITIES.tableIds.push(tableId);
      }

      if (tasks.length) {
        const tableId = 'tasks_table';
        tables.push({
          id: tableId,
          title: 'Tarefas no recorte',
          columns: ['Prazo', 'Título', 'Status', 'Prioridade'],
          rows: tasks.slice(0, 15).map((item: any) => [
            this.formatDate(item.dueDate),
            String(item.titleOverride ?? item.taskTemplate?.title ?? 'Tarefa'),
            this.translateTaskStatus(item.status),
            this.translatePriority(item.priority),
          ]),
          note: tasks.length > 15 ? `Mostrando 15 de ${tasks.length} tarefas.` : null,
        });
        sectionFacts.TASKS.tableIds.push(tableId);
      }

      const topRiskOms = Array.isArray(comgepRoom.details?.omRiskIndex)
        ? comgepRoom.details.omRiskIndex.slice(0, 10)
        : [];
      if (topRiskOms.length) {
        const tableId = 'comgep_top_oms_table';
        tables.push({
          id: tableId,
          title: 'OMs de maior risco',
          columns: ['OM', 'UF', 'Score', 'Cobertura', 'Subnotificação'],
          rows: topRiskOms.map((item: any) => [
            String(item.code ?? item.name ?? 'OM'),
            String(item.uf ?? '-'),
            String(item.riskScore ?? 0),
            item.covered ? 'Coberta' : 'Sem cobertura',
            `${Number(item.underreport?.percent ?? 0).toFixed(1)}%`,
          ]),
        });
        sectionFacts.STRATEGIC_OVERVIEW.tableIds.push(tableId);
      }

      const criticalUfs = Array.isArray(comgepRoom.details?.ufMatrix)
        ? comgepRoom.details.ufMatrix.slice(0, 10)
        : [];
      if (criticalUfs.length) {
        const tableId = 'comgep_ufs_table';
        tables.push({
          id: tableId,
          title: 'UFs com atuação prioritária',
          columns: ['UF', 'Faixa', 'Risco', 'Presença', 'Foco recomendado'],
          rows: criticalUfs.map((item: any) => [
            String(item.uf ?? '-'),
            String(item.priorityBand ?? '-'),
            String(item.riskScore ?? 0),
            String(item.presenceScore ?? 0),
            String(item.recommendedFocus ?? '-'),
          ]),
        });
        sectionFacts.STRATEGIC_OVERVIEW.tableIds.push(tableId);
      }
    }

    if (focusLabelResolved) {
      dataNotes.push(`Recorte solicitado pelo usuário: ${focusLabelResolved}.`);
    }
    if (focusLabel && !focusLabelResolved) {
      dataNotes.push(
        `O sistema não conseguiu resolver com segurança o recorte informado (“${focusLabel}”). O relatório foi gerado sem esse filtro específico.`,
      );
    }
    if (!surveyRows.length) {
      dataNotes.push('Não houve respostas de pesquisa institucional no recorte atual.');
    }
    if (!domesticRows.length) {
      dataNotes.push('Não houve respostas de violência doméstica no recorte atual.');
    }

    return {
      kind,
      scope,
      tone,
      title,
      periodLabel: period.label || 'Sem recorte temporal explícito',
      focusLabel: focusLabelResolved,
      instructions,
      highlights,
      charts,
      tables,
      images,
      dataNotes,
      sectionFacts,
      selectedSections,
    };
  }

  private buildFallbackDraft(context: ReportContext): AssistantGeneratedReportDraft {
    const sections = context.selectedSections.map((sectionId) => {
      const facts = context.sectionFacts[sectionId];
      return {
        id: sectionId,
        title: facts.title,
        body:
          facts.facts[0] ??
          REPORT_SECTION_DESCRIPTION[sectionId] ??
          'Sem observações adicionais para este bloco.',
        bullets: facts.facts.slice(1, 5),
        chartIds: facts.chartIds,
        tableIds: facts.tableIds,
        imageIds: facts.imageIds,
      };
    });

    const recommendations =
      context.selectedSections.includes('RECOMMENDATIONS')
        ? this.buildFallbackRecommendations(context)
        : [];

    return {
      title: context.title,
      subtitle: this.buildSubtitle(context),
      kind: context.kind,
      scope: context.scope,
      tone: context.tone,
      generatedAt: new Date().toISOString(),
      periodLabel: context.periodLabel,
      focusLabel: context.focusLabel,
      executiveSummary: this.buildFallbackExecutiveSummary(context),
      highlights: context.highlights,
      sections,
      charts: context.charts,
      tables: context.tables,
      images: context.images,
      recommendations,
      dataNotes: context.dataNotes,
    };
  }

  private buildSubtitle(context: ReportContext) {
    const parts = [
      context.kind === 'MISSION'
        ? 'Relatório orientado à execução da missão'
        : context.kind === 'STRATEGIC'
          ? 'Relatório estratégico para leitura executiva'
          : 'Relatório operacional com foco em acompanhamento',
      `Escopo ${context.scope}`,
      context.focusLabel ? `Recorte ${context.focusLabel}` : '',
    ].filter(Boolean);
    return parts.join(' • ');
  }

  private buildFallbackExecutiveSummary(context: ReportContext) {
    const kpis = context.highlights
      .slice(0, 4)
      .map((item) => `${item.label}: ${item.value}`)
      .join(' | ');
    const firstFacts = context.selectedSections
      .map((sectionId) => context.sectionFacts[sectionId]?.facts?.[0] ?? '')
      .filter(Boolean)
      .slice(0, 3);
    return [
      `${this.buildSubtitle(context)}.`,
      kpis ? `Indicadores-chave: ${kpis}.` : '',
      firstFacts.length ? firstFacts.join(' ') : '',
      context.instructions
        ? `O relatório foi direcionado pela solicitação do usuário: ${context.instructions}.`
        : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  private buildFallbackRecommendations(context: ReportContext) {
    const items: string[] = [];
    const strategicFacts = context.sectionFacts.STRATEGIC_OVERVIEW?.facts ?? [];
    const complaintFacts = context.sectionFacts.CPCA_CASES?.facts ?? [];
    const taskFacts = context.sectionFacts.TASKS?.facts ?? [];
    if (strategicFacts.length) {
      items.push(
        'Priorizar os itens do topo do ranking executivo, transformando-os em missão, atividade ou tarefa conforme o risco identificado.',
      );
    }
    if (complaintFacts.length) {
      items.push(
        'Concentrar acompanhamento nos casos em aberto e com risco de retaliação, preservando o recorte exibido neste relatório.',
      );
    }
    if (taskFacts.length) {
      items.push(
        'Usar o quadro de tarefas para reduzir pendências vencidas e alinhar responsáveis antes de nova atuação em campo.',
      );
    }
    if (!items.length) {
      items.push(
        'Manter o monitoramento do recorte selecionado e revisar o relatório sempre que novos registros forem inseridos no sistema.',
      );
    }
    return items.slice(0, 4);
  }

  private async generateDraftViaLlm(context: ReportContext) {
    const response = await this.litellm.chatCompletion({
      temperature: 0.35,
      max_tokens: 2800,
      messages: [
        {
          role: 'system',
          content: [
            'Você redige relatórios institucionais do COMAER.',
            'Monte um relatório claro, objetivo e profissional.',
            'Nunca invente fatos, números, nomes, gráficos, tabelas ou imagens fora do contexto factual fornecido.',
            'Você pode reorganizar, renomear e combinar as seções selecionadas, mas deve usar apenas os ativos disponíveis.',
            'Responda apenas em JSON válido.',
          ].join(' '),
        },
        {
          role: 'user',
          content: [
            'Contexto factual do relatório:',
            JSON.stringify(this.buildLlmContextPayload(context), null, 2),
            '',
            'Saída esperada em JSON:',
            JSON.stringify(
              {
                title: 'string',
                subtitle: 'string',
                executiveSummary: 'string',
                sections: [
                  {
                    id: 'STRATEGIC_OVERVIEW',
                    title: 'string',
                    body: 'string',
                    bullets: ['string'],
                    chartIds: ['string'],
                    tableIds: ['string'],
                    imageIds: ['string'],
                  },
                ],
                recommendations: ['string'],
                dataNotes: ['string'],
              },
              null,
              2,
            ),
          ].join('\n'),
        },
      ],
    });
    return this.parseLlmDraft(response.content, context);
  }

  private buildLlmContextPayload(context: ReportContext) {
    return {
      title: context.title,
      kind: context.kind,
      scope: context.scope,
      tone: context.tone,
      periodLabel: context.periodLabel,
      focusLabel: context.focusLabel,
      userInstructions: context.instructions,
      highlights: context.highlights,
      selectedSections: context.selectedSections.map((sectionId) => ({
        id: sectionId,
        title: context.sectionFacts[sectionId].title,
        facts: context.sectionFacts[sectionId].facts,
        availableChartIds: context.sectionFacts[sectionId].chartIds,
        availableTableIds: context.sectionFacts[sectionId].tableIds,
        availableImageIds: context.sectionFacts[sectionId].imageIds,
      })),
      availableCharts: context.charts.map((chart) => ({
        id: chart.id,
        title: chart.title,
        labels: chart.labels,
        values: chart.values,
      })),
      availableTables: context.tables.map((table) => ({
        id: table.id,
        title: table.title,
        columns: table.columns,
        rowCount: table.rows.length,
      })),
      availableImages: context.images.map((image) => ({
        id: image.id,
        title: image.title,
        caption: image.caption ?? null,
      })),
      dataNotes: context.dataNotes,
    };
  }

  private parseLlmDraft(
    content: string,
    context: ReportContext,
  ): Partial<AssistantGeneratedReportDraft> | null {
    const raw = this.extractJsonObject(content);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as any;
      if (!parsed || typeof parsed !== 'object') return null;

      const validChartIds = new Set(context.charts.map((item) => item.id));
      const validTableIds = new Set(context.tables.map((item) => item.id));
      const validImageIds = new Set(context.images.map((item) => item.id));
      const validSectionIds = new Set(context.selectedSections);

      const sections = Array.isArray(parsed.sections)
        ? parsed.sections
            .map((item: any) => {
              const sectionId = String(item?.id ?? '').trim() as AssistantReportSectionId;
              if (!validSectionIds.has(sectionId)) return null;
              return {
                id: sectionId,
                title:
                  this.normalizeOptionalText(item?.title) ??
                  context.sectionFacts[sectionId].title,
                body:
                  this.normalizeOptionalText(item?.body) ??
                  context.sectionFacts[sectionId].facts[0] ??
                  REPORT_SECTION_DESCRIPTION[sectionId],
                bullets: Array.isArray(item?.bullets)
                  ? item.bullets
                      .map((entry: unknown) => this.normalizeOptionalText(entry))
                      .filter(Boolean)
                      .slice(0, 6) as string[]
                  : [],
                chartIds: Array.isArray(item?.chartIds)
                  ? item.chartIds
                      .map((entry: unknown) => String(entry ?? '').trim())
                      .filter((entry: string) => validChartIds.has(entry))
                  : [],
                tableIds: Array.isArray(item?.tableIds)
                  ? item.tableIds
                      .map((entry: unknown) => String(entry ?? '').trim())
                      .filter((entry: string) => validTableIds.has(entry))
                  : [],
                imageIds: Array.isArray(item?.imageIds)
                  ? item.imageIds
                      .map((entry: unknown) => String(entry ?? '').trim())
                      .filter((entry: string) => validImageIds.has(entry))
                  : [],
              };
            })
            .filter(Boolean)
        : [];

      return {
        title: this.normalizeOptionalText(parsed.title) ?? context.title,
        subtitle:
          this.normalizeOptionalText(parsed.subtitle) ?? this.buildSubtitle(context),
        executiveSummary:
          this.normalizeOptionalText(parsed.executiveSummary) ??
          this.buildFallbackExecutiveSummary(context),
        sections:
          sections.length > 0
            ? (sections as AssistantGeneratedReportDraft['sections'])
            : undefined,
        recommendations: Array.isArray(parsed.recommendations)
          ? parsed.recommendations
              .map((entry: unknown) => this.normalizeOptionalText(entry))
              .filter(Boolean)
              .slice(0, 6)
          : undefined,
        dataNotes: Array.isArray(parsed.dataNotes)
          ? parsed.dataNotes
              .map((entry: unknown) => this.normalizeOptionalText(entry))
              .filter(Boolean)
              .slice(0, 8)
          : undefined,
      };
    } catch {
      return null;
    }
  }

  private mergeDraftWithContext(
    llmDraft: Partial<AssistantGeneratedReportDraft>,
    context: ReportContext,
    fallback: AssistantGeneratedReportDraft,
  ): AssistantGeneratedReportDraft {
    return {
      ...fallback,
      title: llmDraft.title ?? fallback.title,
      subtitle: llmDraft.subtitle ?? fallback.subtitle,
      executiveSummary: llmDraft.executiveSummary ?? fallback.executiveSummary,
      sections:
        Array.isArray(llmDraft.sections) && llmDraft.sections.length
          ? llmDraft.sections
          : fallback.sections,
      recommendations:
        Array.isArray(llmDraft.recommendations) && llmDraft.recommendations.length
          ? llmDraft.recommendations
          : fallback.recommendations,
      dataNotes:
        Array.isArray(llmDraft.dataNotes) && llmDraft.dataNotes.length
          ? Array.from(new Set([...fallback.dataNotes, ...llmDraft.dataNotes]))
          : fallback.dataNotes,
      generatedAt: new Date().toISOString(),
      charts: context.charts,
      tables: context.tables,
      images: context.images,
      highlights: context.highlights,
      kind: context.kind,
      scope: context.scope,
      tone: context.tone,
      periodLabel: context.periodLabel,
      focusLabel: context.focusLabel,
    };
  }

  private createEmptySectionFacts(): ReportContext['sectionFacts'] {
    return {
      STRATEGIC_OVERVIEW: {
        title: REPORT_SECTION_LABELS.STRATEGIC_OVERVIEW,
        facts: [],
        chartIds: [],
        tableIds: [],
        imageIds: [],
      },
      MISSION_OVERVIEW: {
        title: REPORT_SECTION_LABELS.MISSION_OVERVIEW,
        facts: [],
        chartIds: [],
        tableIds: [],
        imageIds: [],
      },
      MISSION_SCHEDULE: {
        title: REPORT_SECTION_LABELS.MISSION_SCHEDULE,
        facts: [],
        chartIds: [],
        tableIds: [],
        imageIds: [],
      },
      ACTIVITIES: {
        title: REPORT_SECTION_LABELS.ACTIVITIES,
        facts: [],
        chartIds: [],
        tableIds: [],
        imageIds: [],
      },
      TASKS: {
        title: REPORT_SECTION_LABELS.TASKS,
        facts: [],
        chartIds: [],
        tableIds: [],
        imageIds: [],
      },
      CPCA_CASES: {
        title: REPORT_SECTION_LABELS.CPCA_CASES,
        facts: [],
        chartIds: [],
        tableIds: [],
        imageIds: [],
      },
      SMIF_CASES: {
        title: REPORT_SECTION_LABELS.SMIF_CASES,
        facts: [],
        chartIds: [],
        tableIds: [],
        imageIds: [],
      },
      SURVEY_INSTITUTIONAL: {
        title: REPORT_SECTION_LABELS.SURVEY_INSTITUTIONAL,
        facts: [],
        chartIds: [],
        tableIds: [],
        imageIds: [],
      },
      SURVEY_DOMESTIC: {
        title: REPORT_SECTION_LABELS.SURVEY_DOMESTIC,
        facts: [],
        chartIds: [],
        tableIds: [],
        imageIds: [],
      },
      RECOMMENDATIONS: {
        title: REPORT_SECTION_LABELS.RECOMMENDATIONS,
        facts: [],
        chartIds: [],
        tableIds: [],
        imageIds: [],
      },
    };
  }

  private normalizeKind(value: string | null | undefined): AssistantReportKind {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'MISSION') return 'MISSION';
    if (normalized === 'OPERATIONAL') return 'OPERATIONAL';
    return 'STRATEGIC';
  }

  private normalizeScope(
    value: string | null | undefined,
    kind: AssistantReportKind,
  ): AssistantReportScope {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (kind === 'MISSION') {
      return normalized === 'CIPAVD' ? 'CIPAVD' : 'SMIF';
    }
    if (normalized === 'CPCA') return 'CPCA';
    if (normalized === 'CIPAVD') return 'CIPAVD';
    if (normalized === 'SMIF') return 'SMIF';
    return 'COMGEP';
  }

  private normalizeTone(value: string | null | undefined): AssistantReportTone {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'ANALYTICAL') return 'ANALYTICAL';
    if (normalized === 'OPERATIONAL') return 'OPERATIONAL';
    return 'EXECUTIVE';
  }

  private normalizeTitle(
    value: string | null | undefined,
    kind: AssistantReportKind,
    scope: AssistantReportScope,
  ) {
    const normalized = this.normalizeOptionalText(value);
    if (normalized) return normalized;
    const prefix =
      kind === 'MISSION'
        ? 'Relatório de missão'
        : kind === 'OPERATIONAL'
          ? 'Relatório operacional'
          : 'Relatório executivo';
    return `${prefix} ${scope}`;
  }

  private normalizeSections(
    values: string[] | null | undefined,
    kind: AssistantReportKind,
  ): AssistantReportSectionId[] {
    const allowed =
      kind === 'MISSION'
        ? new Set<AssistantReportSectionId>([
            'MISSION_OVERVIEW',
            'MISSION_SCHEDULE',
            'ACTIVITIES',
            'TASKS',
            'CPCA_CASES',
            'SMIF_CASES',
            'RECOMMENDATIONS',
          ])
        : new Set<AssistantReportSectionId>([
            'STRATEGIC_OVERVIEW',
            'SURVEY_INSTITUTIONAL',
            'SURVEY_DOMESTIC',
            'CPCA_CASES',
            'SMIF_CASES',
            'MISSION_OVERVIEW',
            'ACTIVITIES',
            'TASKS',
            'RECOMMENDATIONS',
          ]);
    const parsed = Array.from(
      new Set(
        (values ?? [])
          .map((item) => String(item ?? '').trim().toUpperCase() as AssistantReportSectionId)
          .filter((item) => allowed.has(item)),
      ),
    );
    if (parsed.length) return parsed;
    return kind === 'MISSION'
      ? ['MISSION_OVERVIEW', 'ACTIVITIES', 'MISSION_SCHEDULE', 'RECOMMENDATIONS']
      : ['STRATEGIC_OVERVIEW', 'CPCA_CASES', 'SURVEY_INSTITUTIONAL', 'TASKS', 'RECOMMENDATIONS'];
  }

  private normalizePeriod(fromRaw: string | null | undefined, toRaw: string | null | undefined) {
    const from = this.normalizeDateOnly(fromRaw);
    const to = this.normalizeDateOnly(toRaw);
    const parts = [
      from ? this.formatDate(from) : null,
      to ? this.formatDate(to) : null,
    ].filter(Boolean);
    return {
      from,
      to,
      label: parts.length === 2 ? `${parts[0]} a ${parts[1]}` : parts[0] ?? parts[1] ?? '',
    };
  }

  private normalizeDateOnly(value: string | null | undefined) {
    const safe = String(value ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(safe)) return null;
    return new Date(`${safe}T00:00:00`);
  }

  private normalizeOptionalText(value: unknown) {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : null;
  }

  private normalizeUf(value: string | null | undefined) {
    const safe = String(value ?? '').trim().toUpperCase();
    return /^[A-Z]{2}$/.test(safe) ? safe : null;
  }

  private async resolveFocusLocality(
    scope: AssistantReportScope,
    value: string | null | undefined,
  ) {
    const safe = this.normalizeOptionalText(value);
    if (!safe) return null;
    const catalogType = scope === 'CIPAVD' ? 'CIPAVD' : 'SMIF';
    const rows = await this.prisma.locality.findMany({
      where: {
        catalogType: catalogType as any,
        OR: [
          { code: { equals: safe, mode: 'insensitive' } as any },
          { name: { equals: safe, mode: 'insensitive' } as any },
        ],
      } as any,
      select: { id: true, code: true, name: true, uf: true },
      take: 2,
    });
    return rows.length === 1 ? rows[0] : null;
  }

  private buildSurveyWhere(period: { from: Date | null; to: Date | null }, omCode: string | null) {
    const where: Record<string, unknown> = {};
    if (period.from || period.to) {
      where.submittedAt = {
        ...(period.from ? { gte: period.from } : {}),
        ...(period.to ? { lte: new Date(period.to.getTime() + 86399999) } : {}),
      };
    }
    if (omCode) where.om = omCode;
    return where;
  }

  private buildDomesticWhere(
    period: { from: Date | null; to: Date | null },
    omCode: string | null,
  ) {
    const where: Record<string, unknown> = {};
    if (period.from || period.to) {
      where.submittedAt = {
        ...(period.from ? { gte: period.from } : {}),
        ...(period.to ? { lte: new Date(period.to.getTime() + 86399999) } : {}),
      };
    }
    if (omCode) where.organization = omCode;
    return where;
  }

  private buildCpcaWhere(
    scope: AssistantReportScope,
    period: { from: Date | null; to: Date | null },
    omId: string | null,
    uf: string | null,
    localityId: string | null,
  ) {
    const where: Record<string, unknown> = {};
    if (scope === 'CPCA') {
      where.workflowScope = 'CPCA';
    } else if (scope === 'SMIF') {
      where.workflowScope = 'SMIF';
    }
    if (period.from || period.to) {
      where.reportedAt = {
        ...(period.from ? { gte: period.from } : {}),
        ...(period.to ? { lte: new Date(period.to.getTime() + 86399999) } : {}),
      };
    }
    if (omId) where.omId = omId;
    if (localityId) where.localityId = localityId;
    if (!omId && !localityId && uf) {
      where.OR = [{ om: { uf } }, { locality: { uf } }];
    }
    return where;
  }

  private buildSmifWhere(
    period: { from: Date | null; to: Date | null },
    uf: string | null,
    localityId: string | null,
  ) {
    const where: Record<string, unknown> = {};
    if (period.from || period.to) {
      where.reportedAt = {
        ...(period.from ? { gte: period.from } : {}),
        ...(period.to ? { lte: new Date(period.to.getTime() + 86399999) } : {}),
      };
    }
    if (localityId) where.localityId = localityId;
    if (!localityId && uf) where.locality = { uf };
    return where;
  }

  private buildMissionWhere(
    scope: AssistantReportScope,
    period: { from: Date | null; to: Date | null },
    uf: string | null,
    localityId: string | null,
  ) {
    const where: Record<string, unknown> = {};
    if (scope === 'SMIF' || scope === 'CIPAVD') {
      where.scope = scope;
    }
    if (period.from || period.to) {
      where.startDate = {
        ...(period.from ? { gte: period.from } : {}),
        ...(period.to ? { lte: new Date(period.to.getTime() + 86399999) } : {}),
      };
    }
    if (localityId) where.localityId = localityId;
    if (!localityId && uf) where.locality = { uf };
    return where;
  }

  private buildActivityWhere(
    scope: AssistantReportScope,
    period: { from: Date | null; to: Date | null },
    uf: string | null,
    localityId: string | null,
  ) {
    const where: Record<string, unknown> = {};
    if (scope === 'SMIF' || scope === 'CIPAVD') {
      where.scope = scope;
    }
    if (period.from || period.to) {
      where.eventDate = {
        ...(period.from ? { gte: period.from } : {}),
        ...(period.to ? { lte: new Date(period.to.getTime() + 86399999) } : {}),
      };
    }
    if (localityId) where.localityId = localityId;
    if (!localityId && uf) where.locality = { uf };
    return where;
  }

  private buildTaskWhere(
    scope: AssistantReportScope,
    period: { from: Date | null; to: Date | null },
    uf: string | null,
    localityId: string | null,
  ) {
    const where: Record<string, unknown> = {};
    if (scope === 'SMIF' || scope === 'CIPAVD') {
      where.scope = scope;
    }
    if (period.from || period.to) {
      where.dueDate = {
        ...(period.from ? { gte: period.from } : {}),
        ...(period.to ? { lte: new Date(period.to.getTime() + 86399999) } : {}),
      };
    }
    if (localityId) where.localityId = localityId;
    if (!localityId && uf) where.locality = { uf };
    return where;
  }

  private countByLabel(values: string[]) {
    const map = new Map<string, number>();
    for (const value of values) {
      const label = String(value ?? '').trim() || 'Não informado';
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return map;
  }

  private createChartFromCounts(
    id: string,
    title: string,
    counts: Map<string, number>,
    colorHex: string,
  ) {
    return this.createChartFromPairs(
      id,
      title,
      [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([label, value]) => ({ label, value })),
      colorHex,
    );
  }

  private createChartFromPairs(
    id: string,
    title: string,
    items: Array<{ label: string; value: number }>,
    colorHex: string,
  ): AssistantReportChart | null {
    const cleaned = items.filter((item) => Number(item.value) > 0).slice(0, 6);
    if (!cleaned.length) return null;
    return {
      id,
      title,
      labels: cleaned.map((item) => this.clampText(item.label, 24)),
      values: cleaned.map((item) => Number(item.value)),
      colorHex,
    };
  }

  private describeTopArrayValues(values: string[], prefix: string) {
    const counts = [...this.countByLabel(values).entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, count]) => `${label} (${count})`);
    return counts.length ? `${prefix}: ${counts.join(', ')}.` : '';
  }

  private async resolveImageBuffer(
    image: AssistantReportImage,
    user?: RbacUser,
  ) {
    if (image.kind === 'mission_banner') {
      return this.missions.buildBannerPng(image.missionId, image.bannerId, user);
    }
    return null;
  }

  private drawCover(doc: PDFKit.PDFDocument, draft: AssistantGeneratedReportDraft) {
    doc.rect(0, 0, doc.page.width, 138).fill('#0F2F5F');
    doc
      .fillColor('#FFFFFF')
      .font('Helvetica-Bold')
      .fontSize(24)
      .text(draft.title, PAGE_MARGIN, 46, {
        width: PAGE_WIDTH,
      });
    doc
      .moveDown(0.4)
      .font('Helvetica')
      .fontSize(12)
      .fillColor('#D9E2EC')
      .text(draft.subtitle, PAGE_MARGIN, doc.y, { width: PAGE_WIDTH });

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#D9E2EC')
      .text(
        `Escopo ${draft.scope} • ${draft.periodLabel} • Gerado em ${this.formatDateTime(draft.generatedAt)}`,
        PAGE_MARGIN,
        112,
        { width: PAGE_WIDTH },
      );
    doc.y = 164;
  }

  private drawHighlights(doc: PDFKit.PDFDocument, draft: AssistantGeneratedReportDraft) {
    if (!draft.highlights.length) return;
    const cardWidth = (PAGE_WIDTH - 18) / 2;
    const cardHeight = 66;
    let x = PAGE_MARGIN;
    let y = doc.y;
    draft.highlights.slice(0, 4).forEach((item, index) => {
      if (index === 2) {
        x = PAGE_MARGIN;
        y += cardHeight + 10;
      }
      doc.roundedRect(x, y, cardWidth, cardHeight, 10).fill('#F4F7FB');
      doc
        .fillColor('#102C57')
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(item.label, x + 12, y + 10, { width: cardWidth - 24 });
      doc
        .font('Helvetica-Bold')
        .fontSize(20)
        .fillColor('#0F2F5F')
        .text(item.value, x + 12, y + 26, { width: cardWidth - 24 });
      if (item.detail) {
        doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor('#52606D')
          .text(item.detail, x + 12, y + 48, { width: cardWidth - 24 });
      }
      x += cardWidth + 18;
    });
    doc.y = y + cardHeight + 18;
  }

  private drawExecutiveSummary(doc: PDFKit.PDFDocument, draft: AssistantGeneratedReportDraft) {
    this.drawSectionHeader(doc, 'Síntese executiva');
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor('#243B53')
      .text(draft.executiveSummary, {
        width: PAGE_WIDTH,
        lineGap: 3,
      });
    doc.moveDown(0.8);
  }

  private drawSectionHeader(doc: PDFKit.PDFDocument, title: string) {
    this.ensureVerticalSpace(doc, 56);
    doc
      .roundedRect(PAGE_MARGIN, doc.y, PAGE_WIDTH, 30, 9)
      .fill('#E8EEF7');
    doc
      .fillColor('#12355B')
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(title, PAGE_MARGIN + 14, doc.y + 9, {
        width: PAGE_WIDTH - 28,
      });
    doc.moveDown(1.8);
  }

  private drawBarChart(doc: PDFKit.PDFDocument, chart: AssistantReportChart) {
    const chartHeight = 120;
    const maxValue = Math.max(...chart.values, 1);
    this.drawSectionMiniTitle(doc, chart.title, chart.subtitle ?? undefined);
    const baseY = doc.y + chartHeight;
    const barWidth = Math.max(24, Math.min(52, PAGE_WIDTH / Math.max(chart.labels.length * 1.7, 1)));
    const gap = 16;
    let x = PAGE_MARGIN + 8;
    doc
      .strokeColor('#D9E2EC')
      .lineWidth(1)
      .moveTo(PAGE_MARGIN, baseY)
      .lineTo(PAGE_MARGIN + PAGE_WIDTH, baseY)
      .stroke();
    chart.labels.forEach((label, index) => {
      const value = chart.values[index] ?? 0;
      const barHeight = Math.max(2, (value / maxValue) * 92);
      doc
        .roundedRect(x, baseY - barHeight, barWidth, barHeight, 6)
        .fill(chart.colorHex ?? '#1A73E8');
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#12355B')
        .text(String(value), x, baseY - barHeight - 14, {
          width: barWidth,
          align: 'center',
        });
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor('#52606D')
        .text(label, x - 8, baseY + 6, {
          width: barWidth + 16,
          align: 'center',
        });
      x += barWidth + gap;
    });
    doc.y = baseY + 28;
  }

  private drawTable(doc: PDFKit.PDFDocument, table: AssistantReportTable) {
    this.ensureVerticalSpace(doc, 84);
    this.drawSectionMiniTitle(doc, table.title, table.note ?? undefined);
    const widths = this.computeTableColumnWidths(table.columns.length);
    const rowHeight = 22;
    let y = doc.y;

    const drawRow = (
      values: string[],
      header: boolean,
    ) => {
      this.ensureVerticalSpace(doc, rowHeight + 10);
      let x = PAGE_MARGIN;
      values.forEach((value, index) => {
        const width = widths[index] ?? widths[widths.length - 1];
        doc
          .rect(x, y, width, rowHeight)
          .fill(header ? '#1A3C6E' : '#FFFFFF')
          .stroke('#D9E2EC');
        doc
          .fillColor(header ? '#FFFFFF' : '#243B53')
          .font(header ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(8.5)
          .text(value, x + 6, y + 6, {
            width: width - 12,
            height: rowHeight - 8,
            ellipsis: true,
          });
        x += width;
      });
      y += rowHeight;
      doc.y = y;
    };

    drawRow(table.columns, true);
    table.rows.slice(0, 14).forEach((row) => drawRow(row, false));
    doc.moveDown(0.8);
  }

  private drawSectionMiniTitle(
    doc: PDFKit.PDFDocument,
    title: string,
    subtitle?: string,
  ) {
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#12355B')
      .text(title, {
        width: PAGE_WIDTH,
      });
    if (subtitle) {
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor('#52606D')
        .text(subtitle, {
          width: PAGE_WIDTH,
        });
    }
    doc.moveDown(0.35);
  }

  private computeTableColumnWidths(columnCount: number) {
    if (columnCount <= 1) return [PAGE_WIDTH];
    if (columnCount === 2) return [PAGE_WIDTH * 0.36, PAGE_WIDTH * 0.64];
    if (columnCount === 3) return [PAGE_WIDTH * 0.18, PAGE_WIDTH * 0.36, PAGE_WIDTH * 0.46];
    if (columnCount === 4) return [PAGE_WIDTH * 0.16, PAGE_WIDTH * 0.34, PAGE_WIDTH * 0.22, PAGE_WIDTH * 0.28];
    return new Array(columnCount).fill(PAGE_WIDTH / columnCount);
  }

  private ensureVerticalSpace(doc: PDFKit.PDFDocument, heightNeeded: number) {
    if (doc.y + heightNeeded <= doc.page.height - PAGE_MARGIN) return;
    doc.addPage();
  }

  private clampText(value: string, maxLength: number) {
    const safe = String(value ?? '').trim();
    if (safe.length <= maxLength) return safe;
    return `${safe.slice(0, maxLength - 1)}…`;
  }

  private calculateInclusiveDays(start: Date, end: Date) {
    const startSafe = new Date(start);
    const endSafe = new Date(end);
    if (Number.isNaN(startSafe.getTime()) || Number.isNaN(endSafe.getTime())) {
      return 0;
    }
    const diffDays = Math.floor(
      (endSafe.getTime() - startSafe.getTime()) / (24 * 60 * 60 * 1000),
    );
    return diffDays >= 0 ? diffDays + 1 : 0;
  }

  private formatDate(value: unknown) {
    const date = new Date(String(value ?? ''));
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  }

  private formatDateTime(value: unknown) {
    const date = new Date(String(value ?? ''));
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Sao_Paulo',
    });
  }

  private translateTaskStatus(status: string) {
    switch (String(status ?? '').toUpperCase()) {
      case 'NOT_STARTED':
        return 'Não iniciada';
      case 'STARTED':
        return 'Iniciada';
      case 'IN_PROGRESS':
        return 'Em andamento';
      case 'DONE':
        return 'Concluída';
      case 'BLOCKED':
        return 'Bloqueada';
      default:
        return status || '—';
    }
  }

  private translatePriority(priority: string) {
    switch (String(priority ?? '').toUpperCase()) {
      case 'CRITICAL':
        return 'Crítica';
      case 'HIGH':
        return 'Alta';
      case 'MEDIUM':
        return 'Média';
      case 'LOW':
        return 'Baixa';
      default:
        return priority || '—';
    }
  }

  private translateComplaintStatus(status: string) {
    switch (String(status ?? '').toUpperCase()) {
      case 'RECEIVED':
        return 'Recebida';
      case 'PROTECTION_MEASURES':
        return 'Medidas protetivas';
      case 'PRELIMINARY_ANALYSIS':
        return 'Análise preliminar';
      case 'PROCEDURE_DEFINED':
        return 'Procedimento definido';
      case 'INVESTIGATION':
        return 'Em apuração';
      case 'CONCLUDED':
        return 'Concluída';
      case 'ARCHIVED':
        return 'Arquivada';
      default:
        return status || '—';
    }
  }

  private hasMilitaryLink(value: string | null | undefined) {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (!normalized) return false;
    if (
      normalized.includes('NAO') ||
      normalized.includes('SEM') ||
      normalized.includes('NENHUM')
    ) {
      return false;
    }
    return (
      normalized.includes('SIM') ||
      normalized.includes('MILITAR') ||
      normalized.includes('FAB') ||
      normalized.includes('FORCA AEREA')
    );
  }

  private extractJsonObject(content: string) {
    const raw = String(content ?? '').trim();
    const match = raw.match(/\{[\s\S]*\}$/);
    return match ? match[0] : null;
  }

  private extractErrorMessage(error: unknown) {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }
    return 'falha inesperada';
  }
}
