import { BadRequestException, Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { BiBestPracticesCycleService } from './bi-best-practices-cycle.service';
import { BiCpcaMeetingService } from './bi-cpca-meeting.service';
import { BiDomesticViolenceService } from './bi-domestic-violence.service';
import { BiGsdEvaluationService } from './bi-gsd-evaluation.service';
import { BiRecruitsService } from './bi-recruits.service';
import { BiService } from './bi.service';

type PdfTheme = {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  muted: string;
  border: string;
  panel: string;
};

type PdfFilterBadge = {
  label: string;
  value: string;
};

type PdfStat = {
  label: string;
  value: string;
  note?: string;
  color?: string;
};

type PdfInsight = {
  title: string;
  value: string;
  detail?: string;
};

type PdfMetricRow = {
  label: string;
  value: string;
  score: number;
  note?: string;
};

type PdfSection = {
  title: string;
  description?: string;
  rows: PdfMetricRow[];
};

type PdfTextItem = {
  title?: string;
  body: string;
  meta?: string;
};

type PdfTextSection = {
  title: string;
  description?: string;
  items: PdfTextItem[];
};

type PdfDefinition = {
  title: string;
  subtitle: string;
  theme: PdfTheme;
  generatedAt: string;
  filters: PdfFilterBadge[];
  stats: PdfStat[];
  insights: PdfInsight[];
  sections: PdfSection[];
  textSections?: PdfTextSection[];
  totalRowsInDb?: number;
  latestImport?: { importedAt?: string | Date | null; fileName?: string | null } | null;
};

export type BiExecutiveNotebookPanelKey =
  | 'surveys'
  | 'domestic-violence'
  | 'recruits'
  | 'best-practices-cycle'
  | 'cpca-meeting'
  | 'gsd-evaluation';

type PdfNotebookPanelRequest = {
  key: BiExecutiveNotebookPanelKey;
  filters?: Record<string, unknown>;
};

type PdfNotebookRequest = {
  title?: string;
  panels?: PdfNotebookPanelRequest[];
};

type FilterLabelMap = Record<string, string>;

const BASE_THEME: PdfTheme = {
  primary: '#0F4C5C',
  secondary: '#2D6A4F',
  accent: '#E76F51',
  text: '#1F2937',
  muted: '#607085',
  border: '#D7E0EA',
  panel: '#F7FAFC',
};

@Injectable()
export class BiPdfService {
  constructor(
    private readonly surveys: BiService,
    private readonly domesticViolence: BiDomesticViolenceService,
    private readonly recruits: BiRecruitsService,
    private readonly bestPracticesCycle: BiBestPracticesCycleService,
    private readonly cpcaMeeting: BiCpcaMeetingService,
    private readonly gsdEvaluation: BiGsdEvaluationService,
  ) {}

  async surveysDashboardPdf(filters: Record<string, unknown>) {
    return this.renderDashboardPdf(
      await this.buildSurveysDashboardDefinition(filters),
    );
  }

  async executiveNotebookPdf(request: PdfNotebookRequest) {
    const panels = this.normalizeNotebookPanels(request?.panels);
    if (panels.length === 0) {
      throw new BadRequestException(
        'Selecione ao menos um painel BI para gerar o caderno executivo.',
      );
    }

    const definitions = await Promise.all(
      panels.map(async (panel) =>
        this.buildDashboardDefinition(panel.key, panel.filters ?? {}),
      ),
    );

    return this.renderNotebookPdf(
      this.cleanText(request?.title) || 'Caderno Executivo de Painéis BI',
      definitions,
    );
  }

  private async buildSurveysDashboardDefinition(filters: Record<string, unknown>) {
    const dashboard = await this.surveys.dashboard(filters as any);
    const cardSettings = dashboard?.cardSettings ?? [];

    return {
      title: this.resolveCardTitle(
        cardSettings,
        'page-header',
        'Painel BI de Pesquisa Institucional',
      ),
      subtitle:
        'Relatório executivo do recorte atual com foco em incidência declarada, distribuição por OM e leitura consolidada dos principais sinais do painel.',
      theme: {
        ...BASE_THEME,
        primary: '#0A4D68',
        secondary: '#0F9D8E',
        accent: '#F08A24',
      },
      generatedAt: new Date().toISOString(),
      filters: this.buildFilterBadges(filters, {
        mission: 'OM/Missão',
        om: 'OM',
        posto: 'Perfil funcional',
        postoGraduacao: 'Posto/Graduação',
        autodeclara: 'Autodeclaração',
        suffered: 'Sofreu violência',
        violenceType: 'Tipo de violência',
        q: 'Busca textual',
        combineMode: 'Combinação',
      }),
      stats: [
        {
          label: this.resolveCardTitle(
            cardSettings,
            'kpi-total-responses',
            'Respostas no recorte',
          ),
          value: this.formatInteger(dashboard?.kpis?.totalResponses),
          note: `Base total: ${this.formatInteger(dashboard?.kpis?.totalRowsInDb)}`,
        },
        {
          label: this.resolveCardTitle(
            cardSettings,
            'kpi-violence-rate',
            'Taxa com relato de violência',
          ),
          value: this.formatPercent(dashboard?.kpis?.violenceRatePercent),
          note: `Sim: ${this.formatInteger(dashboard?.kpis?.yesCount)}`,
          color: '#C62828',
        },
        {
          label: this.resolveCardTitle(
            cardSettings,
            'kpi-violence-mentions',
            'Menções de tipos de violência',
          ),
          value: this.formatInteger(dashboard?.kpis?.totalViolenceMentions),
          note: 'Soma das tipificações declaradas',
        },
        {
          label: 'Média de tipos por vítima',
          value: this.formatDecimal(dashboard?.kpis?.averageTypesPerVictim),
          note: 'Entre respondentes positivas',
        },
      ],
      insights: [
        this.buildOptionalInsight(
          'Tipo mais recorrente',
          dashboard?.insights?.mostCommonType
            ? `${dashboard.insights.mostCommonType.type}`
            : null,
          dashboard?.insights?.mostCommonType
            ? `${this.formatInteger(dashboard.insights.mostCommonType.mentions)} menções`
            : null,
        ),
        this.buildOptionalInsight(
          'OM com maior incidência proporcional',
          dashboard?.insights?.riskiestOm
            ? dashboard.insights.riskiestOm.om
            : null,
          dashboard?.insights?.riskiestOm
            ? `${this.formatPercent(dashboard.insights.riskiestOm.simPercent)} em base ${this.formatInteger(dashboard.insights.riskiestOm.total)}`
            : null,
        ),
        this.buildOptionalInsight(
          'Perfil com mais menções',
          dashboard?.insights?.topProfileByMentions
            ? dashboard.insights.topProfileByMentions.posto
            : null,
          dashboard?.insights?.topProfileByMentions
            ? `${this.formatInteger(dashboard.insights.topProfileByMentions.mentions)} menções`
            : null,
        ),
      ].filter(Boolean) as PdfInsight[],
      sections: [
        this.createDistributionSection(
          this.resolveCardTitle(
            cardSettings,
            'chart-yes-no',
            'Distribuição de respostas',
          ),
          'Leitura direta da proporção de respondentes que declararam ter sofrido violência.',
          dashboard?.charts?.yesNoDonut,
          ['label'],
        ),
        this.createDistributionSection(
          this.resolveCardTitle(
            cardSettings,
            'chart-violence-type',
            'Tipos de violência mais citados',
          ),
          'Ranking dos tipos de violência mencionados no recorte.',
          dashboard?.charts?.violenceTypePercent,
          ['type'],
        ),
        {
          title: this.resolveCardTitle(
            cardSettings,
            'chart-mission-percent',
            'OMs com maior incidência proporcional',
          ),
          description:
            'As linhas abaixo priorizam a taxa de respostas positivas por OM, preservando a base utilizada em cada caso.',
          rows: (dashboard?.charts?.omViolencePercent ?? [])
            .slice(0, 10)
            .map((item: any) => ({
              label: String(item?.om ?? 'Não informado'),
              value: `${this.formatPercent(item?.simPercent)} • base ${this.formatInteger(item?.total)}`,
              score: Number(item?.simPercent ?? 0),
              note: `Sim ${this.formatInteger(item?.simCount)} | Não ${this.formatInteger(item?.naoCount)}`,
            })),
        },
        this.createDistributionSection(
          this.resolveCardTitle(
            cardSettings,
            'chart-profile-types',
            'Perfis funcionais mais presentes',
          ),
          'Distribuição do recorte por perfil funcional, útil para contextualizar a base respondente.',
          dashboard?.charts?.postoDistribution,
          ['label'],
        ),
        {
          title: this.resolveCardTitle(
            cardSettings,
            'chart-monthly-trend',
            'Tendência mensal da incidência',
          ),
          description:
            'Evolução da taxa de respostas positivas ao longo dos meses do recorte.',
          rows: (dashboard?.charts?.monthlyTrend ?? [])
            .slice(-8)
            .map((item: any) => ({
              label: String(item?.month ?? 'Período'),
              value: `${this.formatPercent(item?.yesRatePercent)} • total ${this.formatInteger(item?.total)}`,
              score: Number(item?.yesRatePercent ?? 0),
              note: `Sim ${this.formatInteger(item?.yesCount)} | Não ${this.formatInteger(item?.noCount)}`,
            })),
        },
      ].filter((section) => section.rows.length > 0),
      totalRowsInDb: dashboard?.kpis?.totalRowsInDb,
      latestImport: dashboard?.latestImport,
    };
  }

  async domesticViolenceDashboardPdf(filters: Record<string, unknown>) {
    return this.renderDashboardPdf(
      await this.buildDomesticViolenceDashboardDefinition(filters),
    );
  }

  private async buildDomesticViolenceDashboardDefinition(
    filters: Record<string, unknown>,
  ) {
    const dashboard = await this.domesticViolence.dashboard(filters as any);
    const cardSettings = dashboard?.cardSettings ?? [];

    return {
      title: this.resolveCardTitle(
        cardSettings,
        'page-header',
        'Painel BI de Violência Doméstica',
      ),
      subtitle:
        'Relatório executivo do recorte atual com foco em incidência, recorrência, busca por ajuda e fatores críticos para intervenção institucional.',
      theme: {
        ...BASE_THEME,
        primary: '#0B4A6F',
        secondary: '#2A9D8F',
        accent: '#E76F51',
      },
      generatedAt: new Date().toISOString(),
      filters: this.buildFilterBadges(filters, {
        organization: 'Organização',
        rank: 'Posto/Graduação',
        maritalStatus: 'Estado civil',
        education: 'Escolaridade',
        naturality: 'Naturalidade',
        fabBond: 'Vínculo FAB',
        situationScope: 'Escopo da situação',
        sufferedLifetime: 'Violência ao longo da vida',
        sufferedLast12Months: 'Violência em 12 meses',
        frequency: 'Frequência',
        affectiveBond: 'Vínculo afetivo',
        violenceType: 'Tipo de violência',
        authorRelation: 'Relação com o autor',
        impactIntensity: 'Intensidade do impacto',
        impactArea: 'Área impactada',
        soughtHelp: 'Buscou ajuda',
        complaintChannel: 'Canal de denúncia',
        noComplaintReason: 'Motivo para não denunciar',
        authorMilitaryLink: 'Vínculo militar do autor',
        occurrencePlace: 'Local da ocorrência',
        witnesses: 'Havia testemunhas',
        q: 'Busca textual',
        combineMode: 'Combinação',
      }),
      stats: [
        {
          label: this.resolveCardTitle(cardSettings, 'kpi-total', 'Respostas no recorte'),
          value: this.formatInteger(dashboard?.kpis?.totalResponses),
          note: `Base total: ${this.formatInteger(dashboard?.kpis?.totalRowsInDb)}`,
        },
        {
          label: this.resolveCardTitle(
            cardSettings,
            'kpi-lifetime',
            'Incidência ao longo da vida',
          ),
          value: this.formatPercent(
            this.safePercent(
              dashboard?.kpis?.lifetimeYesCount,
              dashboard?.kpis?.totalResponses,
            ),
          ),
          note: `Sim: ${this.formatInteger(dashboard?.kpis?.lifetimeYesCount)}`,
          color: '#B42318',
        },
        {
          label: this.resolveCardTitle(
            cardSettings,
            'kpi-last12',
            'Incidência nos últimos 12 meses',
          ),
          value: this.formatPercent(
            this.safePercent(
              dashboard?.kpis?.last12MonthsYesCount,
              dashboard?.kpis?.totalResponses,
            ),
          ),
          note: `Sim: ${this.formatInteger(dashboard?.kpis?.last12MonthsYesCount)}`,
          color: '#C77D00',
        },
        {
          label: this.resolveCardTitle(
            cardSettings,
            'kpi-sought-help-rate',
            'Busca por ajuda',
          ),
          value: this.formatPercent(dashboard?.kpis?.soughtHelpRatePercent),
          note: `Sim: ${this.formatInteger(dashboard?.kpis?.soughtHelpYesCount)}`,
        },
        {
          label: this.resolveCardTitle(cardSettings, 'kpi-recurring', 'Recorrência'),
          value: this.formatPercent(dashboard?.kpis?.recurringRatePercent),
          note: `Casos: ${this.formatInteger(dashboard?.kpis?.recurringCount)}`,
          color: '#B42318',
        },
        {
          label: this.resolveCardTitle(
            cardSettings,
            'kpi-avg-types',
            'Média de tipos por vítima',
          ),
          value: this.formatDecimal(dashboard?.kpis?.avgTypesPerVictim),
          note: 'Entre respondentes positivas',
        },
      ],
      insights: [
        this.buildOptionalInsight(
          'Tipo mais citado',
          dashboard?.insights?.topViolenceType?.type,
          dashboard?.insights?.topViolenceType
            ? `${this.formatInteger(dashboard.insights.topViolenceType.mentions)} menções`
            : null,
        ),
        this.buildOptionalInsight(
          'Organização com maior risco',
          dashboard?.insights?.highestOrganizationRisk?.organization,
          dashboard?.insights?.highestOrganizationRisk
            ? `${this.formatPercent(dashboard.insights.highestOrganizationRisk.lifetimeRatePercent)} em base ${this.formatInteger(dashboard.insights.highestOrganizationRisk.total)}`
            : null,
        ),
        this.buildOptionalInsight(
          'Principal barreira para denúncia',
          dashboard?.insights?.mainNoReportReason?.reason,
          dashboard?.insights?.mainNoReportReason
            ? `${this.formatInteger(dashboard.insights.mainNoReportReason.mentions)} menções`
            : null,
        ),
        this.buildOptionalInsight(
          'Canal mais citado',
          dashboard?.insights?.preferredChannel?.channel,
          dashboard?.insights?.preferredChannel
            ? `${this.formatInteger(dashboard.insights.preferredChannel.mentions)} menções`
            : null,
        ),
      ].filter(Boolean) as PdfInsight[],
      sections: [
        this.createDistributionSection(
          this.resolveCardTitle(
            cardSettings,
            'chart-lifetime-donut',
            'Incidência ao longo da vida',
          ),
          'Proporção de respondentes que declaram já ter sofrido violência doméstica em algum momento.',
          dashboard?.charts?.lifetimeDonut,
          ['label'],
        ),
        this.createDistributionSection(
          this.resolveCardTitle(
            cardSettings,
            'chart-last12-donut',
            'Incidência nos últimos 12 meses',
          ),
          'Recorte mais sensível para leitura de risco atual.',
          dashboard?.charts?.last12MonthsDonut,
          ['label'],
        ),
        this.createDistributionSection(
          this.resolveCardTitle(
            cardSettings,
            'chart-violence-type',
            'Tipos de violência mais frequentes',
          ),
          'Ranking consolidado dos tipos de violência citados no recorte.',
          dashboard?.charts?.violenceTypeDistribution,
          ['type', 'label'],
        ),
        {
          title: this.resolveCardTitle(
            cardSettings,
            'chart-violence-by-organization',
            'Organizações com maior concentração de tipos',
          ),
          description:
            'A leitura abaixo mostra as organizações com maior densidade de menções por tipo de violência no recorte.',
          rows: (dashboard?.charts?.violenceByOrganization?.items ?? [])
            .slice(0, 8)
            .map((item: any) => ({
              label: String(item?.organization ?? 'Não informado'),
              value: `${this.formatInteger(item?.total)} menções`,
              score: Number(item?.total ?? 0),
              note: this.formatKeyBreakdown(
                item,
                dashboard?.charts?.violenceByOrganization?.types ?? [],
              ),
            })),
        },
        this.createDistributionSection(
          this.resolveCardTitle(
            cardSettings,
            'chart-impact-area',
            'Áreas mais impactadas',
          ),
          'Impactos mais recorrentes reportados pelas respondentes.',
          dashboard?.charts?.impactAreaDistribution,
          ['area', 'label'],
        ),
        this.createDistributionSection(
          this.resolveCardTitle(
            cardSettings,
            'chart-no-report-reason',
            'Razões mais citadas para não denunciar',
          ),
          'Indicador crítico para direcionar ações de proteção, confiança e acolhimento.',
          dashboard?.charts?.noComplaintReasonDistribution,
          ['reason', 'label'],
        ),
      ].filter((section) => section.rows.length > 0),
      totalRowsInDb: dashboard?.kpis?.totalRowsInDb,
      latestImport: dashboard?.latestImport,
    };
  }

  async recruitsDashboardPdf(filters: Record<string, unknown>) {
    return this.renderDashboardPdf(
      await this.buildRecruitsDashboardDefinition(filters),
    );
  }

  private async buildRecruitsDashboardDefinition(filters: Record<string, unknown>) {
    const dashboard = await this.recruits.dashboard(filters as any);
    const cardSettings = dashboard?.cardSettings ?? [];

    return {
      title: this.resolveCardTitle(
        cardSettings,
        'page-header',
        'Painel BI de Recrutas',
      ),
      subtitle:
        'Relatório executivo do recorte atual com foco em orientação, segurança para denunciar, preparo percebido e sinais qualitativos dos recrutas.',
      theme: {
        ...BASE_THEME,
        primary: '#0A4D68',
        secondary: '#0F9D8E',
        accent: '#F08A24',
      },
      generatedAt: new Date().toISOString(),
      filters: this.buildFilterBadges(filters, {
        education: 'Escolaridade',
        gender: 'Sexo',
        identifyHarassment: 'Reconhece assédio',
        conductLimits: 'Conhece limites de conduta',
        knowOrientation: 'Sabe onde buscar orientação',
        knowReportProcess: 'Conhece processo de denúncia',
        willingnessOrientation: 'Segurança para pedir orientação',
        willingnessReport: 'Segurança para denunciar',
        enlistmentDecisionInfluence: 'Fator da decisão pelo alistamento',
        q: 'Busca textual',
        combineMode: 'Combinação',
      }),
      stats: [
        {
          label: this.resolveCardTitle(cardSettings, 'kpi-total', 'Respostas no recorte'),
          value: this.formatInteger(dashboard?.kpis?.totalResponses),
          note: `Base total: ${this.formatInteger(dashboard?.kpis?.totalRowsInDb)}`,
        },
        {
          label: this.resolveCardTitle(
            cardSettings,
            'kpi-know-orientation',
            'Conhece canais de orientação',
          ),
          value: this.formatPercent(dashboard?.kpis?.knowOrientationYesRatePercent),
          note: `Sim: ${this.formatInteger(dashboard?.kpis?.knowOrientationYesCount)}`,
        },
        {
          label: this.resolveCardTitle(
            cardSettings,
            'kpi-know-report',
            'Conhece o processo de denúncia',
          ),
          value: this.formatPercent(dashboard?.kpis?.knowReportYesRatePercent),
          note: `Sim: ${this.formatInteger(dashboard?.kpis?.knowReportYesCount)}`,
        },
        {
          label: this.resolveCardTitle(
            cardSettings,
            'kpi-secure-orientation',
            'Sente-se seguro para pedir orientação',
          ),
          value: this.formatPercent(dashboard?.kpis?.secureGuidanceRatePercent),
          note: `Seguros: ${this.formatInteger(dashboard?.kpis?.secureGuidanceCount)}`,
        },
        {
          label: this.resolveCardTitle(
            cardSettings,
            'kpi-secure-report',
            'Sente-se seguro para denunciar',
          ),
          value: this.formatPercent(dashboard?.kpis?.secureReportRatePercent),
          note: `Seguros: ${this.formatInteger(dashboard?.kpis?.secureReportCount)}`,
          color: '#C77D00',
        },
      ],
      insights: [
        this.buildOptionalInsight(
          'Escolaridade predominante',
          dashboard?.insights?.topEducation?.label,
          dashboard?.insights?.topEducation
            ? `${this.formatPercent(dashboard.insights.topEducation.percent)} do recorte`
            : null,
        ),
        this.buildOptionalInsight(
          'Principal fator para o alistamento',
          dashboard?.insights?.topDecisionDriver?.label,
          dashboard?.insights?.topDecisionDriver
            ? `${this.formatPercent(dashboard.insights.topDecisionDriver.percent)} do recorte`
            : null,
        ),
        this.buildOptionalInsight(
          'Ponto mais frágil do painel',
          dashboard?.insights?.weakestPoint?.title,
          dashboard?.insights?.weakestPoint
            ? `${this.formatPercent(dashboard.insights.weakestPoint.affectedRatePercent)} afetados`
            : null,
        ),
      ].filter(Boolean) as PdfInsight[],
      sections: [
        this.createDistributionSection(
          this.resolveCardTitle(
            cardSettings,
            'chart-know-orientation',
            'Conhecimento sobre orientação',
          ),
          'Mostra se o recruta sabe onde buscar orientação diante de uma situação de risco.',
          dashboard?.charts?.knowOrientationDistribution,
          ['knowOrientation', 'label'],
        ),
        this.createDistributionSection(
          this.resolveCardTitle(
            cardSettings,
            'chart-know-report-process',
            'Conhecimento sobre denúncia',
          ),
          'Mostra se o recruta conhece o fluxo para formalizar uma denúncia.',
          dashboard?.charts?.knowReportProcessDistribution,
          ['knowReportProcess', 'label'],
        ),
        this.createDistributionSection(
          this.resolveCardTitle(
            cardSettings,
            'chart-willingness-report',
            'Segurança para denunciar',
          ),
          'Termômetro de confiança institucional percebida pelos recrutas.',
          dashboard?.charts?.willingnessReportDistribution,
          ['willingnessReport', 'label'],
        ),
        this.createDistributionSection(
          this.resolveCardTitle(
            cardSettings,
            'chart-education',
            'Distribuição por escolaridade',
          ),
          'Contextualiza o perfil de formação do recorte.',
          dashboard?.charts?.educationDistribution,
          ['education', 'label'],
        ),
        this.createDistributionSection(
          this.resolveCardTitle(
            cardSettings,
            'chart-enlistment-influence',
            'Fatores que influenciaram o alistamento',
          ),
          'Ajuda a entender motivações dominantes e possíveis vieses de comunicação.',
          dashboard?.charts?.enlistmentDecisionInfluenceDistribution,
          ['enlistmentDecisionInfluence', 'label'],
        ),
        {
          title: this.resolveCardTitle(
            cardSettings,
            'chart-response-trend',
            'Tendência de respostas',
          ),
          description:
            'Evolução diária do volume de respostas e do recorte positivo escolhido pelo painel.',
          rows: (dashboard?.charts?.responseTrend ?? [])
            .slice(-8)
            .map((item: any) => ({
              label: String(item?.dayLabel ?? item?.day ?? 'Período'),
              value: `${this.formatInteger(item?.total)} respostas`,
              score: Number(item?.total ?? 0),
              note: `Taxa positiva: ${this.formatPercent(item?.positiveRatePercent)}`,
            })),
        },
      ].filter((section) => section.rows.length > 0),
      textSections: [
        {
          title: 'Sugestões e comentários dos recrutas',
          description:
            'Amostra das manifestações textuais mais úteis para leitura qualitativa do painel.',
          items: (dashboard?.textColumns?.suggestionComment?.items ?? [])
            .slice(0, 6)
            .map((item: any) => ({
              body: String(item?.text ?? '').trim(),
              meta: [
                item?.education ? `Escolaridade: ${item.education}` : null,
                item?.gender ? `Sexo: ${item.gender}` : null,
                item?.submittedAt
                  ? `Data: ${this.formatDateTime(item.submittedAt)}`
                  : null,
              ]
                .filter(Boolean)
                .join(' • '),
            }))
            .filter((item: PdfTextItem) => item.body.length > 0),
        },
      ].filter((section) => section.items.length > 0),
      totalRowsInDb: dashboard?.kpis?.totalRowsInDb,
      latestImport: dashboard?.latestImport,
    };
  }

  async bestPracticesCycleDashboardPdf(filters: Record<string, unknown>) {
    return this.renderDashboardPdf(
      await this.buildBestPracticesCycleDashboardDefinition(filters),
    );
  }

  private async buildBestPracticesCycleDashboardDefinition(
    filters: Record<string, unknown>,
  ) {
    const dashboard = await this.bestPracticesCycle.dashboard(filters as any);
    const cardSettings = dashboard?.cardSettings ?? [];

    return {
      title: this.resolveCardTitle(
        cardSettings,
        'page-header',
        'Painel BI do Ciclo de Boas Práticas',
      ),
      subtitle:
        'Relatório executivo do recorte atual com foco em preparo para liderança de turmas mistas, percepção de viés e desafios centrais do ciclo.',
      theme: {
        ...BASE_THEME,
        primary: '#0B4A6F',
        secondary: '#2A9D8F',
        accent: '#E76F51',
      },
      generatedAt: new Date().toISOString(),
      filters: this.buildFilterBadges(filters, {
        technicalRigorPerception: 'Percepção de rigor técnico',
        preparednessToLeadMixedClass: 'Preparo para liderar turma mista',
        genderBiasImpact: 'Impacto do viés de gênero',
        interactionDifference: 'Diferença de interação',
        supportNeedRecognition: 'Reconhecimento da necessidade de apoio',
        mainChallengeOption: 'Principal desafio',
        identification: 'Identificação',
        specialty: 'Especialidade',
        q: 'Busca textual',
        combineMode: 'Combinação',
      }),
      stats: [
        {
          label: this.resolveCardTitle(cardSettings, 'kpi-total', 'Respostas no recorte'),
          value: this.formatInteger(dashboard?.kpis?.totalResponses),
          note: `Base total: ${this.formatInteger(dashboard?.kpis?.totalRowsInDb)}`,
        },
        {
          label: this.resolveCardTitle(
            cardSettings,
            'kpi-prepared',
            'Preparo positivo para liderança mista',
          ),
          value: this.formatPercent(dashboard?.kpis?.preparedPositiveRatePercent),
          note: `Positivas: ${this.formatInteger(dashboard?.kpis?.preparedPositiveCount)}`,
        },
        {
          label: this.resolveCardTitle(
            cardSettings,
            'kpi-interaction',
            'Diferenças de interação percebidas',
          ),
          value: this.formatPercent(dashboard?.kpis?.interactionYesRatePercent),
          note: `Sim: ${this.formatInteger(dashboard?.kpis?.interactionYesCount)}`,
          color: '#C77D00',
        },
        {
          label: this.resolveCardTitle(
            cardSettings,
            'kpi-support',
            'Reconhecimento frequente de apoio',
          ),
          value: this.formatPercent(dashboard?.kpis?.supportFrequentRatePercent),
          note: `Frequente: ${this.formatInteger(dashboard?.kpis?.supportFrequentCount)}`,
        },
        {
          label: 'Baixa prontidão para liderança',
          value: this.formatPercent(dashboard?.kpis?.lowPreparednessRatePercent),
          note: `Casos: ${this.formatInteger(dashboard?.kpis?.lowPreparednessCount)}`,
          color: '#B42318',
        },
      ],
      insights: [
        this.buildOptionalInsight(
          'Desafio mais recorrente',
          dashboard?.insights?.topChallenge?.label,
          dashboard?.insights?.topChallenge
            ? `${this.formatPercent(dashboard.insights.topChallenge.percent)} do recorte`
            : null,
        ),
        this.buildOptionalInsight(
          'Especialidade mais citada',
          dashboard?.insights?.mostFrequentSpecialty?.text,
          dashboard?.insights?.mostFrequentSpecialty
            ? `${this.formatPercent(dashboard.insights.mostFrequentSpecialty.percent)} do recorte`
            : null,
        ),
        this.buildOptionalInsight(
          'Ponto de atenção',
          dashboard?.insights?.preparednessAttentionPoint?.title,
          dashboard?.insights?.preparednessAttentionPoint
            ? `${this.formatPercent(dashboard.insights.preparednessAttentionPoint.affectedRatePercent)} afetados`
            : null,
        ),
      ].filter(Boolean) as PdfInsight[],
      sections: [
        this.createDistributionSection(
          this.resolveCardTitle(cardSettings, 'chart-q1', 'Percepção de rigor técnico'),
          'Mostra como o ciclo é percebido quanto ao rigor técnico da formação.',
          dashboard?.charts?.technicalRigorDistribution,
          ['technicalRigorPerception', 'label'],
        ),
        this.createDistributionSection(
          this.resolveCardTitle(cardSettings, 'chart-q2', 'Preparo para turma mista'),
          'Indicador central de prontidão para liderar ambientes mistos.',
          dashboard?.charts?.preparednessDistribution,
          ['preparednessToLeadMixedClass', 'label'],
        ),
        this.createDistributionSection(
          this.resolveCardTitle(cardSettings, 'chart-q3', 'Percepção de impacto do viés'),
          'Mostra o quanto o viés de gênero é percebido como fator de impacto.',
          dashboard?.charts?.genderBiasDistribution,
          ['genderBiasImpact', 'label'],
        ),
        this.createDistributionSection(
          this.resolveCardTitle(cardSettings, 'chart-q6', 'Reconhecimento de necessidade de apoio'),
          'Leitura sobre frequência com que o respondente percebe necessidade de apoio específico.',
          dashboard?.charts?.supportNeedDistribution,
          ['supportNeedRecognition', 'label'],
        ),
        this.createDistributionSection(
          this.resolveCardTitle(cardSettings, 'chart-q7', 'Principais desafios percebidos'),
          'Desafios que mais aparecem quando o tema é liderança e convivência em turma mista.',
          dashboard?.charts?.mainChallengeDistribution,
          ['mainChallengeOption', 'label'],
        ),
        {
          title: this.resolveCardTitle(
            cardSettings,
            'chart-trend-q2',
            'Tendência do preparo ao longo do tempo',
          ),
          description:
            'Evolução temporal das respostas sobre preparo para liderar turma mista.',
          rows: (dashboard?.charts?.preparednessTrendByDay?.items ?? [])
            .slice(-8)
            .map((item: any) => ({
              label: String(item?.dayLabel ?? item?.day ?? 'Período'),
              value: `${this.formatInteger(item?.total)} respostas`,
              score: Number(item?.total ?? 0),
              note: this.formatKeyBreakdown(
                item,
                dashboard?.charts?.preparednessTrendByDay?.options ?? [],
              ),
            })),
        },
      ].filter((section) => section.rows.length > 0),
      textSections: [
        {
          title: 'Comentários sobre diferenças de interação',
          description:
            'Amostra qualitativa das observações livres trazidas pelos respondentes.',
          items: (dashboard?.textColumns?.interactionDifferenceComment?.items ?? [])
            .slice(0, 6)
            .map((item: any) => ({
              body: String(item?.text ?? '').trim(),
              meta: [
                item?.identification ? `Identificação: ${item.identification}` : null,
                item?.specialty ? `Especialidade: ${item.specialty}` : null,
                item?.submittedAt
                  ? `Data: ${this.formatDateTime(item.submittedAt)}`
                  : null,
              ]
                .filter(Boolean)
                .join(' • '),
            }))
            .filter((item: PdfTextItem) => item.body.length > 0),
        },
        {
          title: 'Especialidades mais citadas',
          description:
            'Consolidação das especialidades livres informadas, já agrupadas por recorrência.',
          items: (dashboard?.textColumns?.specialtyFreeText?.items ?? [])
            .slice(0, 8)
            .map((item: any) => ({
              title: String(item?.text ?? 'Especialidade'),
              body: `${this.formatInteger(item?.count)} ocorrência(s)`,
              meta: `${this.formatPercent(item?.percent)}`,
            }))
            .filter((item: PdfTextItem) => item.title && item.body),
        },
      ].filter((section) => section.items.length > 0),
      totalRowsInDb: dashboard?.kpis?.totalRowsInDb,
      latestImport: dashboard?.latestImport,
    };
  }

  async cpcaMeetingDashboardPdf(filters: Record<string, unknown>) {
    return this.renderDashboardPdf(
      await this.buildCpcaMeetingDashboardDefinition(filters),
    );
  }

  private async buildCpcaMeetingDashboardDefinition(
    filters: Record<string, unknown>,
  ) {
    const dashboard = await this.cpcaMeeting.dashboard(filters as any);
    const cardSettings = dashboard?.cardSettings ?? [];
    const columnsMeta = dashboard?.columnsMeta ?? [];
    const columnLabelByKey = new Map(
      columnsMeta.map((item: any) => [String(item?.key ?? ''), String(item?.label ?? '')]),
    );

    return {
      title: this.resolveCardTitle(
        cardSettings,
        'page-header',
        'Painel BI do Encontro CPCA',
      ),
      subtitle:
        'Relatório executivo do recorte atual com foco em aderência do preenchimento, distribuições mais sensíveis e síntese das respostas textuais do encontro.',
      theme: {
        ...BASE_THEME,
        primary: '#0F4C5C',
        secondary: '#2D6A4F',
        accent: '#E76F51',
      },
      generatedAt: new Date().toISOString(),
      filters: this.buildColumnFilterBadges(
        filters,
        {
          q: 'Busca textual',
          combineMode: 'Combinação',
        },
        columnLabelByKey,
      ),
      stats: [
        {
          label: 'Respostas no recorte',
          value: this.formatInteger(dashboard?.kpis?.totalResponses),
          note: `Base total: ${this.formatInteger(dashboard?.kpis?.totalRowsInDb)}`,
        },
        {
          label: 'Taxa de preenchimento',
          value: this.formatPercent(dashboard?.kpis?.completionRatePercent),
          note: 'Quanto maior, melhor o aproveitamento analítico',
        },
        {
          label: 'Perguntas categóricas',
          value: this.formatInteger(dashboard?.kpis?.categoricalQuestions),
          note: 'Entram em distribuição quantitativa',
        },
        {
          label: 'Perguntas de texto livre',
          value: this.formatInteger(dashboard?.kpis?.freeTextQuestions),
          note: 'Entram em consolidação qualitativa',
        },
      ],
      insights: [
        this.buildOptionalInsight(
          'Distribuição mais forte',
          dashboard?.insights?.topDistribution
            ? `${dashboard.insights.topDistribution.questionLabel}`
            : null,
          dashboard?.insights?.topDistribution
            ? `${dashboard.insights.topDistribution.optionLabel} • ${this.formatPercent(dashboard.insights.topDistribution.percent)}`
            : null,
        ),
        this.buildOptionalInsight(
          'Texto livre mais ativo',
          dashboard?.insights?.topFreeText?.label,
          dashboard?.insights?.topFreeText
            ? `${this.formatInteger(dashboard.insights.topFreeText.totalResponses)} respostas`
            : null,
        ),
        this.buildOptionalInsight(
          'Preenchimento global',
          dashboard?.insights?.completion?.title,
          dashboard?.insights?.completion
            ? `${this.formatPercent(dashboard.insights.completion.answeredRatePercent)} • ${this.formatInteger(dashboard.insights.completion.filledCells)}/${this.formatInteger(dashboard.insights.completion.totalCells)} células`
            : null,
        ),
      ].filter(Boolean) as PdfInsight[],
      sections: [
        ...(dashboard?.charts?.categoricalDistributions ?? [])
          .slice(0, 6)
          .map((chart: any) =>
            this.createDistributionSection(
              this.resolveCardTitle(
                cardSettings,
                `chart:${String(chart?.key ?? '')}`,
                String(chart?.label ?? 'Distribuição'),
              ),
              'Recorte das opções mais frequentes para esta pergunta do encontro CPCA.',
              chart?.data,
              ['label'],
            ),
          ),
        dashboard?.charts?.question2TrendByDay?.questionLabel
          ? {
              title: 'Tendência temporal da pergunta-chave',
              description:
                `Evolução diária da pergunta "${String(dashboard.charts.question2TrendByDay.questionLabel)}".`,
              rows: (dashboard?.charts?.question2TrendByDay?.items ?? [])
                .slice(-8)
                .map((item: any) => ({
                  label: String(item?.dayLabel ?? item?.day ?? 'Período'),
                  value: `${this.formatInteger(item?.total)} respostas`,
                  score: Number(item?.total ?? 0),
                  note: this.formatKeyBreakdown(
                    item,
                    dashboard?.charts?.question2TrendByDay?.options ?? [],
                  ),
                })),
            }
          : null,
      ].filter(
        (section): section is PdfSection =>
          section !== null && section.rows.length > 0,
      ),
      textSections: (dashboard?.textColumns?.freeTextLists ?? [])
        .slice(0, 4)
        .map((list: any) => ({
          title: this.resolveCardTitle(
            cardSettings,
            `text:${String(list?.key ?? '')}`,
            String(list?.label ?? 'Texto livre'),
          ),
          description:
            'Consolidação das respostas livres mais recorrentes no recorte atual.',
          items: (list?.items ?? [])
            .slice(0, 8)
            .map((item: any) => ({
              title: String(item?.text ?? '').trim(),
              body: `${this.formatInteger(item?.count)} ocorrência(s)`,
              meta: `${this.formatPercent(item?.percent)}`,
            }))
            .filter((item: PdfTextItem) => item.title && item.body),
      }))
        .filter((section: PdfTextSection) => section.items.length > 0),
      totalRowsInDb: dashboard?.kpis?.totalRowsInDb,
      latestImport: dashboard?.latestImport,
    };
  }

  async gsdEvaluationDashboardPdf(filters: Record<string, unknown>) {
    return this.renderDashboardPdf(
      await this.buildGsdEvaluationDashboardDefinition(filters),
    );
  }

  private async buildGsdEvaluationDashboardDefinition(
    filters: Record<string, unknown>,
  ) {
    const dashboard = await this.gsdEvaluation.dashboard(filters as any);
    const cardSettings = dashboard?.cardSettings ?? [];
    const columnsMeta = dashboard?.columnsMeta ?? [];
    const columnLabelByKey = new Map(
      columnsMeta.map((item: any) => [String(item?.key ?? ''), String(item?.label ?? '')]),
    );

    return {
      title: this.resolveCardTitle(
        cardSettings,
        'page-header',
        'Painel BI de Avaliação GSD',
      ),
      subtitle:
        'Relatório executivo do recorte atual com foco em preenchimento, distribuições centrais e consolidação dos comentários qualitativos da avaliação GSD.',
      theme: {
        ...BASE_THEME,
        primary: '#0F4C5C',
        secondary: '#2D6A4F',
        accent: '#F4A261',
      },
      generatedAt: new Date().toISOString(),
      filters: this.buildColumnFilterBadges(
        filters,
        {
          q: 'Busca textual',
          combineMode: 'Combinação',
        },
        columnLabelByKey,
      ),
      stats: [
        {
          label: 'Respostas no recorte',
          value: this.formatInteger(dashboard?.kpis?.totalResponses),
          note: `Base total: ${this.formatInteger(dashboard?.kpis?.totalRowsInDb)}`,
        },
        {
          label: 'Taxa de preenchimento',
          value: this.formatPercent(dashboard?.kpis?.completionRatePercent),
          note: 'Qualidade do preenchimento do instrumento',
        },
        {
          label: 'Perguntas categóricas',
          value: this.formatInteger(dashboard?.kpis?.categoricalQuestions),
          note: 'Entram em distribuição quantitativa',
        },
        {
          label: 'Perguntas de texto livre',
          value: this.formatInteger(dashboard?.kpis?.freeTextQuestions),
          note: 'Entram em consolidação qualitativa',
        },
      ],
      insights: [
        this.buildOptionalInsight(
          'Distribuição mais forte',
          dashboard?.insights?.topDistribution
            ? `${dashboard.insights.topDistribution.questionLabel}`
            : null,
          dashboard?.insights?.topDistribution
            ? `${dashboard.insights.topDistribution.optionLabel} • ${this.formatPercent(dashboard.insights.topDistribution.percent)}`
            : null,
        ),
        this.buildOptionalInsight(
          'Texto livre mais ativo',
          dashboard?.insights?.topFreeText?.label,
          dashboard?.insights?.topFreeText
            ? `${this.formatInteger(dashboard.insights.topFreeText.totalResponses)} respostas`
            : null,
        ),
        this.buildOptionalInsight(
          'Preenchimento global',
          dashboard?.insights?.completion?.title,
          dashboard?.insights?.completion
            ? `${this.formatPercent(dashboard.insights.completion.answeredRatePercent)} • ${this.formatInteger(dashboard.insights.completion.filledCells)}/${this.formatInteger(dashboard.insights.completion.totalCells)} células`
            : null,
        ),
      ].filter(Boolean) as PdfInsight[],
      sections: (dashboard?.charts?.categoricalDistributions ?? [])
        .slice(0, 6)
        .map((chart: any) =>
          this.createDistributionSection(
            this.resolveCardTitle(
              cardSettings,
              `chart:${String(chart?.key ?? '')}`,
              String(chart?.label ?? 'Distribuição'),
            ),
            'Recorte das opções mais frequentes para esta pergunta da avaliação GSD.',
            chart?.data,
            ['label'],
          ),
        )
        .filter((section: PdfSection) => section.rows.length > 0),
      textSections: (dashboard?.textColumns?.freeTextLists ?? [])
        .slice(0, 4)
        .map((list: any) => ({
          title: this.resolveCardTitle(
            cardSettings,
            `text:${String(list?.key ?? '')}`,
            String(list?.label ?? 'Texto livre'),
          ),
          description:
            'Consolidação das respostas livres mais recorrentes no recorte atual.',
          items: (list?.items ?? [])
            .slice(0, 8)
            .map((item: any) => ({
              title: String(item?.text ?? '').trim(),
              body: `${this.formatInteger(item?.count)} ocorrência(s)`,
              meta: `${this.formatPercent(item?.percent)}`,
            }))
            .filter((item: PdfTextItem) => item.title && item.body),
      }))
        .filter((section: PdfTextSection) => section.items.length > 0),
      totalRowsInDb: dashboard?.kpis?.totalRowsInDb,
      latestImport: dashboard?.latestImport,
    };
  }

  private async buildDashboardDefinition(
    key: BiExecutiveNotebookPanelKey,
    filters: Record<string, unknown>,
  ) {
    switch (key) {
      case 'surveys':
        return this.buildSurveysDashboardDefinition(filters);
      case 'domestic-violence':
        return this.buildDomesticViolenceDashboardDefinition(filters);
      case 'recruits':
        return this.buildRecruitsDashboardDefinition(filters);
      case 'best-practices-cycle':
        return this.buildBestPracticesCycleDashboardDefinition(filters);
      case 'cpca-meeting':
        return this.buildCpcaMeetingDashboardDefinition(filters);
      case 'gsd-evaluation':
        return this.buildGsdEvaluationDashboardDefinition(filters);
      default:
        throw new BadRequestException(`Painel BI inválido: ${String(key)}`);
    }
  }

  private normalizeNotebookPanels(
    panels: PdfNotebookRequest['panels'],
  ): PdfNotebookPanelRequest[] {
    const allowed = new Set<BiExecutiveNotebookPanelKey>([
      'surveys',
      'domestic-violence',
      'recruits',
      'best-practices-cycle',
      'cpca-meeting',
      'gsd-evaluation',
    ]);

    const normalized: PdfNotebookPanelRequest[] = [];
    const seen = new Set<BiExecutiveNotebookPanelKey>();

    for (const panel of panels ?? []) {
      const key = String(panel?.key ?? '').trim() as BiExecutiveNotebookPanelKey;
      if (!allowed.has(key) || seen.has(key)) continue;
      seen.add(key);
      normalized.push({
        key,
        filters:
          panel?.filters && typeof panel.filters === 'object'
            ? { ...panel.filters }
            : undefined,
      });
    }

    return normalized;
  }

  private createDistributionSection(
    title: string,
    description: string,
    items: Array<Record<string, unknown>> | undefined,
    labelKeys: string[],
  ): PdfSection {
    const rows = (items ?? []).slice(0, 8).map((item) => {
      const label =
        labelKeys
          .map((key) => String(item?.[key] ?? '').trim())
          .find(Boolean) || 'Não informado';
      const count = Number(item?.count ?? 0);
      const percent = Number(item?.percent ?? 0);
      return {
        label,
        value: `${this.formatInteger(count)} • ${this.formatPercent(percent)}`,
        score: Number.isFinite(percent) && percent > 0 ? percent : count,
      };
    });

    return {
      title,
      description,
      rows,
    };
  }

  private buildFilterBadges(
    filters: Record<string, unknown>,
    labels: FilterLabelMap,
  ): PdfFilterBadge[] {
    const badges: PdfFilterBadge[] = [];
    const from = this.cleanText(filters?.from);
    const to = this.cleanText(filters?.to);
    if (from || to) {
      badges.push({
        label: 'Período',
        value: `${from || '...'} até ${to || '...'}`,
      });
    }

    for (const [key, label] of Object.entries(labels)) {
      if (key === 'combineMode') {
        const mode = this.cleanText(filters?.[key]);
        if (!mode) continue;
        badges.push({
          label,
          value: mode === 'OR' ? 'Qualquer filtro (OU)' : 'Todos os filtros (E)',
        });
        continue;
      }
      if (key === 'from' || key === 'to') continue;
      const value = this.cleanText(filters?.[key]);
      if (!value) continue;
      badges.push({ label, value });
    }

    if (badges.length === 0) {
      badges.push({ label: 'Recorte', value: 'Base completa sem filtros adicionais' });
    }

    return badges.slice(0, 14);
  }

  private buildColumnFilterBadges(
    filters: Record<string, unknown>,
    labels: FilterLabelMap,
    columnLabelByKey: Map<string, string>,
  ) {
    const badges = this.buildFilterBadges(filters, labels);
    const rawColumnFilters = filters?.columnFilters;
    const parsed = this.parseColumnFilters(rawColumnFilters);
    if (
      Object.keys(parsed).length > 0 &&
      badges.length === 1 &&
      badges[0]?.label === 'Recorte'
    ) {
      badges.length = 0;
    }
    for (const [key, rawValue] of Object.entries(parsed)) {
      const value = this.cleanText(rawValue);
      if (!value) continue;
      badges.push({
        label: columnLabelByKey.get(key) || key,
        value,
      });
    }
    return badges.slice(0, 16);
  }

  private parseColumnFilters(raw: unknown): Record<string, string> {
    if (!raw) return {};
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      return Object.fromEntries(
        Object.entries(raw as Record<string, unknown>).map(([key, value]) => [
          key,
          this.cleanText(value) || '',
        ]),
      );
    }
    if (typeof raw !== 'string') return {};
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.fromEntries(
          Object.entries(parsed).map(([key, value]) => [
            key,
            this.cleanText(value) || '',
          ]),
        );
      }
    } catch {}
    return {};
  }

  private renderDashboardPdf(def: PdfDefinition): Promise<Buffer> {
    return this.renderPdfDocument({ dashboards: [def] });
  }

  private renderNotebookPdf(
    notebookTitle: string,
    dashboards: PdfDefinition[],
  ): Promise<Buffer> {
    return this.renderPdfDocument({
      notebookTitle,
      dashboards,
    });
  }

  private renderPdfDocument({
    notebookTitle,
    dashboards,
  }: {
    notebookTitle?: string;
    dashboards: PdfDefinition[];
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 42,
        bufferPages: true,
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const LEFT = 42;
      const RIGHT = doc.page.width - 42;
      const WIDTH = RIGHT - LEFT;
      const BOTTOM = doc.page.height - 40;
      const isNotebook = dashboards.length > 1;
      const footerLabel = isNotebook
        ? 'Caderno executivo BI • Documento gerencial interno'
        : 'Documento gerencial interno';

      const drawNotebookCover = () => {
        const coverPrimary = '#0C314D';
        const coverSecondary = '#164D72';
        const coverAccent = '#F4A261';
        const panels = dashboards.slice(0, 6);

        doc.rect(0, 0, doc.page.width, 210).fill(coverPrimary);
        doc.rect(0, 210, doc.page.width, 8).fill(coverAccent);
        doc
          .font('Helvetica-Bold')
          .fontSize(27)
          .fillColor('#FFFFFF')
          .text(notebookTitle || 'Caderno Executivo de Painéis BI', LEFT, 48, {
            width: WIDTH,
          });
        doc
          .font('Helvetica')
          .fontSize(11)
          .fillColor('#D8E7F2')
          .text(
            'Consolidação única dos painéis selecionados para briefing gerencial, com capítulos independentes e filtros explícitos por painel.',
            LEFT,
            96,
            { width: WIDTH * 0.84 },
          );

        const metaWidth = (WIDTH - 16) / 3;
        const metaY = 246;
        const drawCoverMetaCard = (
          x: number,
          label: string,
          value: string,
        ) => {
          doc
            .roundedRect(x, metaY, metaWidth, 52, 8)
            .fill('#FFFFFF')
            .strokeColor('#D8E2EC')
            .lineWidth(0.7)
            .stroke();
          doc
            .font('Helvetica')
            .fontSize(8)
            .fillColor('#607085')
            .text(label, x + 12, metaY + 10, { width: metaWidth - 24 });
          doc
            .font('Helvetica-Bold')
            .fontSize(11)
            .fillColor(coverPrimary)
            .text(value, x + 12, metaY + 24, { width: metaWidth - 24 });
        };

        drawCoverMetaCard(LEFT, 'Gerado em', this.formatDateTime(new Date().toISOString()));
        drawCoverMetaCard(LEFT + metaWidth + 8, 'Painéis incluídos', String(dashboards.length));
        drawCoverMetaCard(
          LEFT + (metaWidth + 8) * 2,
          'Formato',
          'Caderno PDF executivo',
        );

        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor(coverPrimary)
          .text('Capítulos incluídos', LEFT, 332, { width: WIDTH });
        doc
          .font('Helvetica')
          .fontSize(8.8)
          .fillColor('#607085')
          .text(
            'Cada capítulo preserva o layout executivo do painel original e explicita se houve uso de base completa ou recorte filtrado.',
            LEFT,
            348,
            { width: WIDTH },
          );

        const cardWidth = (WIDTH - 14) / 2;
        const cardHeight = 86;
        const startY = 384;

        panels.forEach((panel, index) => {
          const col = index % 2;
          const row = Math.floor(index / 2);
          const x = LEFT + col * (cardWidth + 14);
          const y = startY + row * (cardHeight + 14);
          const filterNote =
            panel.filters.length === 1 && panel.filters[0]?.label === 'Recorte'
              ? 'Base completa'
              : `${panel.filters.length} filtro(s) aplicados`;

          doc
            .roundedRect(x, y, cardWidth, cardHeight, 10)
            .fill('#F8FBFD')
            .strokeColor('#D8E2EC')
            .lineWidth(0.8)
            .stroke();
          doc
            .roundedRect(x + 12, y + 12, 26, 26, 13)
            .fill(coverSecondary);
          doc
            .font('Helvetica-Bold')
            .fontSize(10)
            .fillColor('#FFFFFF')
            .text(String(index + 1).padStart(2, '0'), x + 12, y + 19, {
              width: 26,
              align: 'center',
            });
          doc
            .font('Helvetica-Bold')
            .fontSize(10.2)
            .fillColor(coverPrimary)
            .text(panel.title, x + 48, y + 12, {
              width: cardWidth - 60,
            });
          doc
            .font('Helvetica')
            .fontSize(7.8)
            .fillColor('#607085')
            .text(panel.subtitle, x + 48, y + 30, {
              width: cardWidth - 60,
              height: 28,
            });
          doc
            .font('Helvetica-Bold')
            .fontSize(8)
            .fillColor(coverSecondary)
            .text(filterNote, x + 14, y + 62, { width: cardWidth - 28 });
        });

        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#607085')
          .text(
            'Uso restrito para gestão. Cada capítulo foi gerado a partir do estado atual dos painéis BI do sistema.',
            LEFT,
            doc.page.height - 54,
            { width: WIDTH, align: 'center' },
          );
      };

      const drawDashboardChapter = (def: PdfDefinition, chapterIndex: number) => {
        const chapterLabel = isNotebook
          ? `Capítulo ${chapterIndex}/${dashboards.length}`
          : null;

        const ensureSpace = (needed: number) => {
          if (doc.y + needed > BOTTOM) {
            doc.addPage();
            doc.y = 52;
          }
        };

        const drawHeader = () => {
          doc.rect(0, 0, doc.page.width, 86).fill(def.theme.primary);
          doc.rect(0, 86, doc.page.width, 5).fill(def.theme.accent);
          doc
            .font('Helvetica-Bold')
            .fontSize(20)
            .fillColor('#FFFFFF')
            .text(def.title, LEFT, 28, {
              width: WIDTH - (chapterLabel ? 118 : 0),
            });
          doc
            .font('Helvetica')
            .fontSize(9.5)
            .fillColor('#E9F1F7')
            .text(def.subtitle, LEFT, 54, {
              width: WIDTH - (chapterLabel ? 118 : 0),
            });
          if (chapterLabel) {
            const chipWidth = 104;
            const chipX = RIGHT - chipWidth;
            doc
              .roundedRect(chipX, 26, chipWidth, 28, 14)
              .fill('#FFFFFF');
            doc
              .font('Helvetica-Bold')
              .fontSize(8.8)
              .fillColor(def.theme.primary)
              .text(chapterLabel, chipX, 36, {
                width: chipWidth,
                align: 'center',
              });
          }
          doc.y = 110;
        };

        const sectionHeader = (index: string, title: string) => {
          ensureSpace(30);
          doc
            .roundedRect(LEFT, doc.y, WIDTH, 24, 5)
            .fill(def.theme.primary);
          doc
            .font('Helvetica-Bold')
            .fontSize(10.5)
            .fillColor('#FFFFFF')
            .text(`${index} ${title}`, LEFT + 10, doc.y + 7, {
              width: WIDTH - 20,
            });
          doc.y += 32;
        };

        const drawMetaCard = (
          x: number,
          y: number,
          width: number,
          label: string,
          value: string,
        ) => {
          doc
            .roundedRect(x, y, width, 44, 6)
            .fill(def.theme.panel)
            .strokeColor(def.theme.border)
            .lineWidth(0.7)
            .stroke();
          doc
            .font('Helvetica')
            .fontSize(7.5)
            .fillColor(def.theme.muted)
            .text(label, x + 10, y + 8, { width: width - 20 });
          doc
            .font('Helvetica-Bold')
            .fontSize(10)
            .fillColor(def.theme.text)
            .text(value, x + 10, y + 20, { width: width - 20 });
        };

        const drawBadge = (badge: PdfFilterBadge) => {
          const text = `${badge.label}: ${badge.value}`;
          doc.font('Helvetica').fontSize(8);
          const width = Math.min(WIDTH, Math.max(110, doc.widthOfString(text) + 22));
          if (doc.x + width > RIGHT) {
            doc.x = LEFT;
            doc.y += 26;
          }
          doc
            .roundedRect(doc.x, doc.y, width, 20, 10)
            .fill(def.theme.panel)
            .strokeColor(def.theme.border)
            .lineWidth(0.6)
            .stroke();
          doc
            .font('Helvetica')
            .fontSize(8)
            .fillColor(def.theme.text)
            .text(text, doc.x + 10, doc.y + 6, {
              width: width - 20,
            });
          doc.x += width + 8;
        };

        const drawStatCard = (
          x: number,
          y: number,
          width: number,
          stat: PdfStat,
        ) => {
          const color = stat.color || def.theme.primary;
          doc
            .roundedRect(x, y, width, 72, 7)
            .fill('#FFFFFF')
            .strokeColor(def.theme.border)
            .lineWidth(0.8)
            .stroke();
          doc.roundedRect(x, y, 6, 72, 3).fill(color);
          doc
            .font('Helvetica')
            .fontSize(7.5)
            .fillColor(def.theme.muted)
            .text(stat.label, x + 14, y + 10, {
              width: width - 24,
            });
          doc
            .font('Helvetica-Bold')
            .fontSize(18)
            .fillColor(color)
            .text(stat.value, x + 14, y + 28, {
              width: width - 24,
            });
          if (stat.note) {
            doc
              .font('Helvetica')
              .fontSize(7.5)
              .fillColor(def.theme.text)
              .text(stat.note, x + 14, y + 52, {
                width: width - 24,
              });
          }
        };

        const drawInsightCard = (
          x: number,
          y: number,
          width: number,
          insight: PdfInsight,
        ) => {
          const height = 68;
          doc
            .roundedRect(x, y, width, height, 7)
            .fill(def.theme.panel)
            .strokeColor(def.theme.border)
            .lineWidth(0.7)
            .stroke();
          doc
            .font('Helvetica')
            .fontSize(7.5)
            .fillColor(def.theme.muted)
            .text(insight.title, x + 10, y + 9, { width: width - 20 });
          doc
            .font('Helvetica-Bold')
            .fontSize(11.5)
            .fillColor(def.theme.text)
            .text(insight.value, x + 10, y + 24, { width: width - 20 });
          if (insight.detail) {
            doc
              .font('Helvetica')
              .fontSize(8)
              .fillColor(def.theme.primary)
              .text(insight.detail, x + 10, y + 45, { width: width - 20 });
          }
        };

        const drawMetricSection = (section: PdfSection) => {
          ensureSpace(54);
          if (section.title) {
            doc
              .font('Helvetica-Bold')
              .fontSize(12)
              .fillColor(def.theme.text)
              .text(section.title, LEFT, doc.y, { width: WIDTH });
            doc.y += 16;
          }
          if (section.description) {
            doc
              .font('Helvetica')
              .fontSize(8.5)
              .fillColor(def.theme.muted)
              .text(section.description, LEFT, doc.y, {
                width: WIDTH,
              });
            doc.y += 18;
          }

          const maxScore = Math.max(
            1,
            ...section.rows.map((row) => Number(row.score || 0)),
          );
          for (const row of section.rows) {
            ensureSpace(24);
            const rowY = doc.y;
            const labelWidth = WIDTH * 0.42;
            const barX = LEFT + labelWidth + 10;
            const barW = WIDTH * 0.32;
            const barH = 8;
            const score = Number(row.score || 0);
            const fillW = Math.max(3, (Math.max(0, score) / maxScore) * barW);

            doc
              .font('Helvetica')
              .fontSize(8.4)
              .fillColor(def.theme.text)
              .text(row.label, LEFT, rowY, {
                width: labelWidth,
              });
            doc.roundedRect(barX, rowY + 2, barW, barH, 4).fill('#E8EEF4');
            doc
              .roundedRect(barX, rowY + 2, fillW, barH, 4)
              .fill(def.theme.secondary);
            doc
              .font('Helvetica-Bold')
              .fontSize(8.3)
              .fillColor(def.theme.primary)
              .text(row.value, barX + barW + 10, rowY, {
                width: WIDTH - (barX + barW + 10 - LEFT),
              });
            if (row.note) {
              doc
                .font('Helvetica')
                .fontSize(7.4)
                .fillColor(def.theme.muted)
                .text(row.note, LEFT, rowY + 12, {
                  width: WIDTH,
                });
              doc.y += 24;
            } else {
              doc.y += 16;
            }
          }
          doc.y += 8;
        };

        const drawTextSection = (section: PdfTextSection) => {
          ensureSpace(54);
          if (section.title) {
            doc
              .font('Helvetica-Bold')
              .fontSize(12)
              .fillColor(def.theme.text)
              .text(section.title, LEFT, doc.y, { width: WIDTH });
            doc.y += 16;
          }
          if (section.description) {
            doc
              .font('Helvetica')
              .fontSize(8.5)
              .fillColor(def.theme.muted)
              .text(section.description, LEFT, doc.y, {
                width: WIDTH,
              });
            doc.y += 18;
          }

          for (const item of section.items) {
            const titleHeight = item.title
              ? doc
                  .font('Helvetica-Bold')
                  .fontSize(9)
                  .heightOfString(item.title, {
                    width: WIDTH - 32,
                  })
              : 0;
            const bodyHeight = doc
              .font('Helvetica')
              .fontSize(9)
              .heightOfString(item.body, {
                width: WIDTH - 32,
              });
            const metaHeight = item.meta
              ? doc
                  .font('Helvetica')
                  .fontSize(7.5)
                  .heightOfString(item.meta, {
                    width: WIDTH - 32,
                  })
              : 0;
            const totalHeight = 18 + titleHeight + bodyHeight + metaHeight;
            ensureSpace(totalHeight + 10);

            const y = doc.y;
            doc
              .roundedRect(LEFT, y, WIDTH, totalHeight, 7)
              .fill('#FFFFFF')
              .strokeColor(def.theme.border)
              .lineWidth(0.7)
              .stroke();
            doc.roundedRect(LEFT, y, 5, totalHeight, 3).fill(def.theme.accent);

            let cursorY = y + 10;
            if (item.title) {
              doc
                .font('Helvetica-Bold')
                .fontSize(9)
                .fillColor(def.theme.text)
                .text(item.title, LEFT + 12, cursorY, {
                  width: WIDTH - 24,
                });
              cursorY += titleHeight + 4;
            }
            doc
              .font('Helvetica')
              .fontSize(8.7)
              .fillColor(def.theme.text)
              .text(item.body, LEFT + 12, cursorY, {
                width: WIDTH - 24,
                align: 'justify',
              });
            cursorY += bodyHeight + 4;
            if (item.meta) {
              doc
                .font('Helvetica')
                .fontSize(7.5)
                .fillColor(def.theme.muted)
                .text(item.meta, LEFT + 12, cursorY, {
                  width: WIDTH - 24,
                });
            }
            doc.y = y + totalHeight + 10;
          }
        };

        drawHeader();

        sectionHeader('01', 'Contexto do recorte');
        const metaY = doc.y;
        const metaWidth = (WIDTH - 16) / 3;
        drawMetaCard(
          LEFT,
          metaY,
          metaWidth,
          'Gerado em',
          this.formatDateTime(def.generatedAt),
        );
        drawMetaCard(
          LEFT + metaWidth + 8,
          metaY,
          metaWidth,
          'Respostas na base total',
          this.formatInteger(def.totalRowsInDb),
        );
        drawMetaCard(
          LEFT + (metaWidth + 8) * 2,
          metaY,
          metaWidth,
          'Última importação',
          def.latestImport?.importedAt
            ? this.formatDateTime(def.latestImport.importedAt)
            : 'Não informada',
        );
        doc.y = metaY + 56;
        if (def.latestImport?.fileName) {
          doc
            .font('Helvetica')
            .fontSize(8)
            .fillColor(def.theme.muted)
            .text(`Arquivo-base mais recente: ${def.latestImport.fileName}`, LEFT, doc.y, {
              width: WIDTH,
            });
          doc.y += 16;
        }

        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(def.theme.text)
          .text('Filtros aplicados', LEFT, doc.y, { width: WIDTH });
        doc.y += 12;
        doc.x = LEFT;
        for (const badge of def.filters) {
          drawBadge(badge);
        }
        doc.x = LEFT;
        doc.y += 28;

        sectionHeader('02', 'Indicadores prioritários');
        const statWidth = (WIDTH - 16) / 3;
        for (let index = 0; index < def.stats.length; index += 1) {
          const rowIndex = Math.floor(index / 3);
          const colIndex = index % 3;
          const x = LEFT + colIndex * (statWidth + 8);
          const y = doc.y + rowIndex * 80;
          drawStatCard(x, y, statWidth, def.stats[index]);
        }
        doc.y += Math.ceil(def.stats.length / 3) * 80 + 4;

        sectionHeader('03', 'Leituras executivas');
        const insightWidth = (WIDTH - 8) / 2;
        for (let index = 0; index < def.insights.length; index += 1) {
          ensureSpace(76);
          const rowIndex = Math.floor(index / 2);
          const colIndex = index % 2;
          const x = LEFT + colIndex * (insightWidth + 8);
          const y = doc.y + rowIndex * 76;
          drawInsightCard(x, y, insightWidth, def.insights[index]);
        }
        doc.y += Math.ceil(def.insights.length / 2) * 76 + 4;

        let sectionIndex = 4;
        for (const section of def.sections) {
          sectionHeader(this.padSection(sectionIndex), section.title);
          drawMetricSection({
            ...section,
            title: '',
          });
          sectionIndex += 1;
        }

        for (const textSection of def.textSections ?? []) {
          sectionHeader(this.padSection(sectionIndex), textSection.title);
          drawTextSection({
            ...textSection,
            title: '',
          });
          sectionIndex += 1;
        }
      };

      if (isNotebook) {
        drawNotebookCover();
        dashboards.forEach((dashboard, index) => {
          doc.addPage();
          drawDashboardChapter(dashboard, index + 1);
        });
      } else if (dashboards[0]) {
        drawDashboardChapter(dashboards[0], 1);
      }

      const pageRange = doc.bufferedPageRange();
      for (let i = 0; i < pageRange.count; i += 1) {
        doc.switchToPage(i);
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#607085')
          .text(
            `${footerLabel} • Página ${i + 1}/${pageRange.count}`,
            LEFT,
            doc.page.height - 24,
            { width: WIDTH, align: 'center' },
          );
      }

      doc.end();
    });
  }

  private resolveCardTitle(
    cardSettings: Array<{ cardId?: string; title?: string | null }> | undefined,
    cardId: string,
    fallback: string,
  ) {
    const match = (cardSettings ?? []).find(
      (item) => String(item?.cardId ?? '').trim() === cardId,
    );
    const title = String(match?.title ?? '').trim();
    return title || fallback;
  }

  private buildOptionalInsight(
    title: string,
    value: string | null | undefined,
    detail?: string | null,
  ): PdfInsight | null {
    const safeValue = this.cleanText(value);
    if (!safeValue) return null;
    const safeDetail = this.cleanText(detail);
    return {
      title,
      value: safeValue,
      detail: safeDetail || undefined,
    };
  }

  private cleanText(value: unknown) {
    const safe = String(value ?? '').trim();
    return safe.length > 0 ? safe : null;
  }

  private formatInteger(value: unknown) {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric)
      ? Math.round(numeric).toLocaleString('pt-BR')
      : '0';
  }

  private formatDecimal(value: unknown) {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric)
      ? numeric.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : '0,00';
  }

  private formatPercent(value: unknown) {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric)
      ? `${numeric.toLocaleString('pt-BR', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}%`
      : '0,0%';
  }

  private safePercent(numerator: unknown, denominator: unknown) {
    const num = Number(numerator ?? 0);
    const den = Number(denominator ?? 0);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return 0;
    return Number(((num / den) * 100).toFixed(1));
  }

  private formatDateTime(value: unknown) {
    const date = new Date(String(value ?? ''));
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('pt-BR');
  }

  private padSection(index: number) {
    return String(index).padStart(2, '0');
  }

  private formatKeyBreakdown(item: Record<string, unknown>, keys: string[]) {
    const fragments = keys
      .map((key) => {
        const value = Number(item?.[key] ?? 0);
        if (!Number.isFinite(value) || value <= 0) return null;
        return `${key}: ${this.formatInteger(value)}`;
      })
      .filter(Boolean);
    return fragments.join(' • ');
  }
}
