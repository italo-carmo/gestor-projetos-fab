import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BiNormalizationService } from '../bi/bi-normalization.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityScope } from '@prisma/client';
import {
  AI_KNOWLEDGE_SOURCE_IDS,
  ALL_KNOWLEDGE_SOURCE_IDS,
  AiAnalysisType,
  AiKnowledgeSourceId,
} from '../ai/ai-knowledge-sources';
import {
  LitellmService,
  LITELLM_API_KEY_ENV_KEYS,
  LITELLM_BASE_URL_ENV_KEYS,
} from '../llm/litellm.service';
import PDFDocument from 'pdfkit';
import type { RbacUser } from '../rbac/rbac.types';
import { SettingsService } from '../settings/settings.service';

const PT_STOPWORDS = new Set([
  'a',
  'à',
  'ao',
  'aos',
  'aquela',
  'aquelas',
  'aquele',
  'aqueles',
  'aquilo',
  'as',
  'até',
  'com',
  'como',
  'da',
  'das',
  'de',
  'dela',
  'delas',
  'dele',
  'deles',
  'depois',
  'do',
  'dos',
  'e',
  'é',
  'ela',
  'elas',
  'ele',
  'eles',
  'em',
  'entre',
  'era',
  'essa',
  'essas',
  'esse',
  'esses',
  'esta',
  'estas',
  'este',
  'estes',
  'eu',
  'foi',
  'for',
  'foram',
  'ha',
  'há',
  'isso',
  'isto',
  'já',
  'lhe',
  'lhes',
  'lo',
  'mais',
  'mas',
  'me',
  'mesmo',
  'meu',
  'minha',
  'muito',
  'na',
  'nas',
  'não',
  'nao',
  'nem',
  'no',
  'nos',
  'nós',
  'nossa',
  'nosso',
  'num',
  'numa',
  'o',
  'os',
  'ou',
  'para',
  'pela',
  'pelas',
  'pelo',
  'pelos',
  'por',
  'qual',
  'quando',
  'que',
  'quem',
  'se',
  'sem',
  'ser',
  'seu',
  'sua',
  'são',
  'só',
  'também',
  'te',
  'tem',
  'tenho',
  'ter',
  'teu',
  'ti',
  'todo',
  'todos',
  'tu',
  'tua',
  'tudo',
  'um',
  'uma',
  'umas',
  'uns',
  'vai',
  'vão',
  'você',
  'vocês',
  'vos',
  'nessa',
  'nesse',
  'nessas',
  'nesses',
  'nesta',
  'neste',
  'nestas',
  'nestes',
  'sobre',
  'ainda',
  'então',
  'onde',
  'aqui',
  'ali',
  'lá',
  'cá',
  'sim',
  'pode',
  'pode',
  'fazer',
  'feito',
  'ter',
  'sido',
  'sendo',
  'tendo',
  'seria',
  'suas',
  'seus',
  'meus',
  'minhas',
  'dele',
  'dela',
  'deles',
  'delas',
  'nossos',
  'nossas',
  'todo',
  'toda',
  'todas',
  'cada',
  'outra',
  'outro',
  'outras',
  'outros',
  'algum',
  'alguma',
  'alguns',
  'algumas',
  'nenhum',
  'nenhuma',
  'nenhuns',
  'nenhumas',
  'tanto',
  'tanta',
  'tantos',
  'tantas',
  'esse',
  'essa',
  'esses',
  'essas',
  'este',
  'esta',
  'estes',
  'estas',
  'aquele',
  'aquela',
  'aqueles',
  'aquelas',
  'quanto',
  'quanta',
  'quantos',
  'quantas',
  'qual',
  'quais',
  'que',
  'quem',
  'onde',
  'porque',
  'pois',
  'como',
  'assim',
  'porém',
  'contudo',
  'entretanto',
  'todavia',
  'mas',
  'embora',
  'embora',
  'senão',
  'caso',
  'desde',
  'durante',
  'através',
  'após',
  'antes',
  'depois',
  'enquanto',
  'logo',
  'pra',
  'pro',
  'dos',
  'das',
  'nos',
  'nas',
  'num',
  'numa',
  'nuns',
  'numas',
  'dum',
  'duma',
  'duns',
  'dumas',
  'pelo',
  'pela',
  'pelos',
  'pelas',
  'sim',
  'não',
  'nao',
  'talvez',
  'jamais',
  'sempre',
  'nunca',
  'apenas',
  'somente',
  'quase',
  'bastante',
  'demais',
  'menos',
  'pouco',
  'poucos',
  'muita',
  'muitas',
  'muitos',
  'muito',
  'tão',
  'tanto',
  'tanta',
  'tantos',
  'tantas',
  'maior',
  'menor',
  'melhor',
  'pior',
  'bem',
  'mal',
  'bom',
  'boa',
  'bons',
  'boas',
  'grande',
  'grandes',
  'pequeno',
  'pequena',
  'pequenos',
  'pequenas',
  'parte',
  'forma',
  'vez',
  'vezes',
  'dia',
  'dias',
  'ano',
  'anos',
  'mês',
  'tempo',
  'coisa',
  'coisas',
  'pessoa',
  'pessoas',
  'gente',
  'homem',
  'mulher',
  'vida',
  'mundo',
  'casa',
  'exemplo',
  'tipo',
  'lado',
  'modo',
  'conta',
  'ponto',
  'fato',
  'falta',
]);

const ENGLISH_OUTPUT_MARKERS = [
  /\bthe\b/g,
  /\band\b/g,
  /\bwith\b/g,
  /\bfrom\b/g,
  /\bthis\b/g,
  /\bthat\b/g,
  /\bhere(?:\s+is|['’]s)\b/g,
  /\bbased on\b/g,
  /\bsummary\b/g,
  /\bfindings?\b/g,
  /\bdata\b/g,
  /\bindicat(?:e|es|ed|ing)\b/g,
  /\bshould\b/g,
  /\bmust\b/g,
] as const;

const PORTUGUESE_OUTPUT_MARKERS = [
  /\bnao\b/g,
  /\bpara\b/g,
  /\bcom\b/g,
  /\buma\b/g,
  /\bdados\b/g,
  /\banalise\b/g,
  /\bresumo\b/g,
  /\bcontexto\b/g,
  /\bsituacao\b/g,
  /\brisco(?:s)?\b/g,
  /\bdenuncia(?:s)?\b/g,
] as const;

function tokenizeAndCount(
  texts: string[],
  minLen = 3,
): { word: string; count: number }[] {
  const freq = new Map<string, number>();
  for (const text of texts) {
    if (!text) continue;
    const words = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= minLen && !PT_STOPWORDS.has(w));
    for (const w of words) {
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
  }
  return Array.from(freq.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);
}

function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 1000) / 10 : 0;
}

function countByField(
  items: any[],
  field: string,
): { label: string; count: number; percent: number }[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const rawValue = item[field];
    const values = Array.isArray(rawValue)
      ? rawValue.map((value) => String(value ?? '').trim()).filter(Boolean)
      : [String(rawValue ?? 'Não informado').trim() || 'Não informado'];
    const uniqueValues = values.length
      ? Array.from(new Set(values))
      : ['Não informado'];
    for (const val of uniqueValues) {
      map.set(val, (map.get(val) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({
      label,
      count,
      percent: pct(count, items.length),
    }))
    .sort((a, b) => b.count - a.count);
}

type StrategicSourceFilter = {
  sources?: readonly AiKnowledgeSourceId[];
};

export type AiSourceReference = {
  id: string;
  label: string;
  href: string;
  description?: string;
};

type StrategicKpiDetailItem = {
  id: string;
  title: string;
  subtitle?: string;
  date?: string;
  badge?: string;
  link: string;
};

type StrategicGeoOmRow = {
  id: string;
  code: string;
  name: string;
  uf: string | null;
  hasCpca: boolean;
  cpcaCoverageAsManaged: {
    managerOm: {
      id: string;
      code: string;
      name: string;
    };
  }[];
};

type StrategicCoveredOmItem = {
  id: string;
  code: string;
  name: string;
  uf: string | null;
  hasCpca: boolean;
  coverageType: 'OWN' | 'MANAGED';
  coveredByOms: {
    id: string;
    code: string;
    name: string;
  }[];
};

@Injectable()
export class StrategicService {
  private readonly logger = new Logger(StrategicService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly litellm: LitellmService,
    private readonly biNormalization: BiNormalizationService,
    private readonly settings: SettingsService,
  ) {}

  private normalizeTextForLanguageCheck(text: string) {
    return String(text ?? '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]*`/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/https?:\/\/\S+/gi, ' ')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private countLanguagePatternMatches(
    source: string,
    patterns: readonly RegExp[],
  ) {
    return patterns.reduce((total, pattern) => {
      const matches = source.match(pattern);
      return total + (matches?.length ?? 0);
    }, 0);
  }

  private looksLikeEnglishOutput(text: string) {
    const sample = this.normalizeTextForLanguageCheck(text);
    if (!sample || sample.length < 24) return false;

    const englishMatches = this.countLanguagePatternMatches(
      sample,
      ENGLISH_OUTPUT_MARKERS,
    );
    const portugueseMatches = this.countLanguagePatternMatches(
      sample,
      PORTUGUESE_OUTPUT_MARKERS,
    );
    const hasEnglishHeading =
      /^#{1,6}\s*(findings?|summary|overview|recommendations?)\b/im.test(
        String(text ?? ''),
      );

    if (hasEnglishHeading && portugueseMatches === 0) {
      return true;
    }
    if (englishMatches >= 3 && portugueseMatches === 0) {
      return true;
    }
    return englishMatches >= 6 && englishMatches >= portugueseMatches * 2 + 2;
  }

  private async enforcePortugueseNarrative(narrative: string) {
    const cleaned = String(narrative ?? '').trim();
    if (!cleaned || !this.looksLikeEnglishOutput(cleaned)) {
      return cleaned;
    }

    this.logger.warn(
      'Saída em idioma divergente detectada no resumo executivo; tentando reescrever para pt-BR.',
    );
    try {
      const response = await this.litellm.chatCompletion({
        messages: [
          {
            role: 'system',
            content: [
              'Você é um revisor final de idioma.',
              'Reescreva exclusivamente em português do Brasil.',
              'Preserve integralmente fatos, números, datas, links e a estrutura Markdown.',
              'Não acrescente informação nova.',
              'Entregue apenas a versão final reescrita.',
            ].join(' '),
          },
          {
            role: 'user',
            content: `Reescreva o texto abaixo para pt-BR, preservando o conteúdo:\n\n${cleaned}`,
          },
        ],
        temperature: 0.05,
        max_tokens: 2200,
      });
      const rewritten = String(response.content ?? '').trim();
      if (rewritten && !this.looksLikeEnglishOutput(rewritten)) {
        return rewritten;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Falha ao reescrever resumo executivo em português: ${message}`,
      );
    }

    return 'Não foi possível garantir a resposta final em português do Brasil nesta execução.';
  }

  private resolveSourceSet(
    sources?: readonly AiKnowledgeSourceId[],
  ): ReadonlySet<AiKnowledgeSourceId> {
    const values = sources !== undefined ? sources : ALL_KNOWLEDGE_SOURCE_IDS;
    return new Set(values);
  }

  private hasSource(
    sourceSet: ReadonlySet<AiKnowledgeSourceId>,
    sourceId: AiKnowledgeSourceId,
  ): boolean {
    return sourceSet.has(sourceId);
  }

  private buildComplaintScopeFilter(
    sourceSet: ReadonlySet<AiKnowledgeSourceId>,
  ): ('CPCA' | 'SMIF')[] {
    const scopes: ('CPCA' | 'SMIF')[] = [];
    if (this.hasSource(sourceSet, AI_KNOWLEDGE_SOURCE_IDS.COMPLAINTS_CPCA)) {
      scopes.push('CPCA');
    }
    if (this.hasSource(sourceSet, AI_KNOWLEDGE_SOURCE_IDS.COMPLAINTS_SMIF)) {
      scopes.push('SMIF');
    }
    return scopes;
  }

  private buildActivityScopeFilter(
    sourceSet: ReadonlySet<AiKnowledgeSourceId>,
  ): { in: ActivityScope[] } | undefined {
    const scopes: ActivityScope[] = [];
    if (this.hasSource(sourceSet, AI_KNOWLEDGE_SOURCE_IDS.ACTIVITIES_SMIF)) {
      scopes.push('SMIF');
    }
    if (this.hasSource(sourceSet, AI_KNOWLEDGE_SOURCE_IDS.ACTIVITIES_CIPAVD)) {
      scopes.push('CIPAVD');
    }
    if (scopes.length === 0 || scopes.length === 2) {
      return undefined;
    }

    return { in: scopes };
  }

  private hasTaskSource(sourceSet: ReadonlySet<AiKnowledgeSourceId>): boolean {
    return this.hasSource(sourceSet, AI_KNOWLEDGE_SOURCE_IDS.TASKS);
  }

  private hasMissionSource(
    sourceSet: ReadonlySet<AiKnowledgeSourceId>,
  ): boolean {
    return this.hasSource(sourceSet, AI_KNOWLEDGE_SOURCE_IDS.MISSIONS);
  }

  private hasComplaintSources(
    sourceSet: ReadonlySet<AiKnowledgeSourceId>,
  ): boolean {
    return (
      this.hasSource(sourceSet, AI_KNOWLEDGE_SOURCE_IDS.COMPLAINTS_CPCA) ||
      this.hasSource(sourceSet, AI_KNOWLEDGE_SOURCE_IDS.COMPLAINTS_SMIF)
    );
  }

  private hasActivitySource(
    sourceSet: ReadonlySet<AiKnowledgeSourceId>,
  ): boolean {
    return (
      this.hasSource(sourceSet, AI_KNOWLEDGE_SOURCE_IDS.ACTIVITIES_SMIF) ||
      this.hasSource(sourceSet, AI_KNOWLEDGE_SOURCE_IDS.ACTIVITIES_CIPAVD)
    );
  }

  private hasSurveySources(
    sourceSet: ReadonlySet<AiKnowledgeSourceId>,
  ): boolean {
    return this.hasSource(sourceSet, AI_KNOWLEDGE_SOURCE_IDS.SURVEY_SCHOOLS);
  }

  private hasDomesticViolenceSources(
    sourceSet: ReadonlySet<AiKnowledgeSourceId>,
  ): boolean {
    return this.hasSource(
      sourceSet,
      AI_KNOWLEDGE_SOURCE_IDS.SURVEY_DOMESTIC_VIOLENCE,
    );
  }

  private hasRecruitSources(
    sourceSet: ReadonlySet<AiKnowledgeSourceId>,
  ): boolean {
    return this.hasSource(sourceSet, AI_KNOWLEDGE_SOURCE_IDS.SURVEY_RECRUITS);
  }

  private hasTextSourceSet(sourceSet: ReadonlySet<AiKnowledgeSourceId>): {
    bestPracticeCycle: boolean;
    cpcaMeeting: boolean;
    gsdEvaluation: boolean;
    activityReports: boolean;
    recruits: boolean;
    complaints: boolean;
  } {
    return {
      bestPracticeCycle: this.hasSource(
        sourceSet,
        AI_KNOWLEDGE_SOURCE_IDS.SURVEY_BEST_PRACTICE_CYCLE,
      ),
      cpcaMeeting: this.hasSource(
        sourceSet,
        AI_KNOWLEDGE_SOURCE_IDS.SURVEY_CPCA_MEETING,
      ),
      gsdEvaluation: this.hasSource(
        sourceSet,
        AI_KNOWLEDGE_SOURCE_IDS.SURVEY_GSD_EVALUATION,
      ),
      activityReports: this.hasSource(
        sourceSet,
        AI_KNOWLEDGE_SOURCE_IDS.ACTIVITY_REPORTS,
      ),
      recruits: this.hasRecruitSources(sourceSet),
      complaints: this.hasComplaintSources(sourceSet),
    };
  }

  private formatOmDisplayLabel(
    code: string | null | undefined,
    name: string | null | undefined,
  ) {
    const codeValue = String(code ?? '').trim();
    const nameValue = String(name ?? '').trim();
    if (codeValue && nameValue) {
      if (
        codeValue.localeCompare(nameValue, 'pt-BR', {
          sensitivity: 'base',
        }) === 0
      ) {
        return codeValue;
      }
      return `${codeValue} - ${nameValue}`;
    }
    return codeValue || nameValue;
  }

  private summarizeBiNormalizationCoverage(args: {
    sourceLabel: string;
    populationLabel: string;
    totalRecords: number;
    links: Array<{
      sourceRecordId?: string | null;
      omId?: string | null;
      uf?: string | null;
      status?: string | null;
      om?: { uf?: string | null } | null;
    }>;
  }) {
    const linkedRecordIds = new Set(
      args.links
        .map((item) => String(item.sourceRecordId ?? '').trim())
        .filter(Boolean),
    );
    const matchedLinks = args.links.filter(
      (item) =>
        String(item.status ?? '')
          .trim()
          .toUpperCase() === 'MATCHED',
    );
    const ufOnlyLinks = args.links.filter(
      (item) =>
        String(item.status ?? '')
          .trim()
          .toUpperCase() === 'UF_ONLY',
    );
    const supportedLinks = [...matchedLinks, ...ufOnlyLinks];
    const matchedOms = new Set(
      matchedLinks
        .map((item) => String(item.omId ?? '').trim())
        .filter(Boolean),
    );
    const supportedUfs = new Set(
      supportedLinks
        .map((item) =>
          String(item.uf ?? item.om?.uf ?? '')
            .trim()
            .toUpperCase(),
        )
        .filter(Boolean),
    );

    return {
      sourceLabel: args.sourceLabel,
      populationLabel: args.populationLabel,
      totalRecords: args.totalRecords,
      matchedRecords: matchedLinks.length,
      ufOnlyRecords: ufOnlyLinks.length,
      notFoundRecords: args.links.filter(
        (item) =>
          String(item.status ?? '')
            .trim()
            .toUpperCase() === 'NOT_FOUND',
      ).length,
      notApplicableRecords: args.links.filter(
        (item) =>
          String(item.status ?? '')
            .trim()
            .toUpperCase() === 'NOT_APPLICABLE',
      ).length,
      notLinkedRecords: Math.max(args.totalRecords - linkedRecordIds.size, 0),
      matchedOms: matchedOms.size,
      supportedUfs: supportedUfs.size,
      supportedCoveragePercent: pct(supportedLinks.length, args.totalRecords),
    };
  }

  private buildEvidenceSummary(total: number, positive: number) {
    const safeTotal = Math.max(Number(total) || 0, 0);
    const safePositive = Math.max(Number(positive) || 0, 0);
    const rate = safeTotal > 0 ? (safePositive / safeTotal) * 100 : 0;
    const credibility = safeTotal > 0 ? safeTotal / (safeTotal + 20) : 0;
    let evidenceLevel = 'SEM_BASE';
    if (safeTotal >= 30) evidenceLevel = 'ALTA';
    else if (safeTotal >= 10) evidenceLevel = 'MODERADA';
    else if (safeTotal > 0) evidenceLevel = 'BAIXA';

    return {
      total: safeTotal,
      positive: safePositive,
      rate: Number(rate.toFixed(1)),
      adjustedRate: Number((rate * credibility).toFixed(1)),
      credibility: Number(credibility.toFixed(3)),
      evidenceLevel,
    };
  }

  private buildUnderreportEstimate(args: {
    signalCount: number;
    formalCases: number;
    researchTotal: number;
    basis: 'OM' | 'UF';
  }) {
    const signalCount = Math.max(Number(args.signalCount) || 0, 0);
    const formalCases = Math.max(Number(args.formalCases) || 0, 0);
    const researchTotal = Math.max(Number(args.researchTotal) || 0, 0);
    const missingCases = Math.max(signalCount - formalCases, 0);
    const eligible = researchTotal >= 10 && signalCount >= 3;
    const status =
      researchTotal === 0
        ? 'NO_RESEARCH'
        : eligible
          ? 'ESTIMATED'
          : 'INSUFFICIENT_RESEARCH';

    return {
      signalCount,
      formalCases,
      missingCases: eligible ? missingCases : 0,
      percent:
        eligible && signalCount > 0
          ? Number(((missingCases / signalCount) * 100).toFixed(1))
          : 0,
      eligible,
      status,
      basis: args.basis,
      researchTotal,
      confidence:
        researchTotal >= 30
          ? 'ALTA'
          : researchTotal >= 10
            ? 'MODERADA'
            : 'BAIXA',
    };
  }

  private async getCrossSourceCoverage() {
    const [complaints, links] = await Promise.all([
      (this.prisma as any).cpcComplaintCase.findMany({
        select: {
          omId: true,
          workflowScope: true,
          om: {
            select: {
              uf: true,
            },
          },
        },
      }),
      this.prisma.biNormalizationLink.findMany({
        where: {
          sourceType: { in: ['SURVEY_SCHOOLS', 'DOMESTIC_VIOLENCE'] },
          status: { in: ['MATCHED', 'UF_ONLY'] },
        },
        select: {
          sourceType: true,
          omId: true,
          uf: true,
          status: true,
          om: {
            select: {
              uf: true,
            },
          },
        },
      }),
    ]);

    const complaintOms = new Set<string>();
    const complaintUfs = new Set<string>();
    const cpcaComplaintOms = new Set<string>();
    const smifComplaintOms = new Set<string>();
    for (const item of complaints as any[]) {
      const omId = String(item?.omId ?? '').trim();
      const uf = String(item?.om?.uf ?? '')
        .trim()
        .toUpperCase();
      const scope = String(item?.workflowScope ?? 'CPCA')
        .trim()
        .toUpperCase();
      if (omId) {
        complaintOms.add(omId);
        if (scope === 'SMIF') smifComplaintOms.add(omId);
        else cpcaComplaintOms.add(omId);
      }
      if (uf) complaintUfs.add(uf);
    }

    const schoolOms = new Set<string>();
    const schoolUfs = new Set<string>();
    const domesticOms = new Set<string>();
    const domesticUfs = new Set<string>();
    for (const link of links as any[]) {
      const sourceType = String(link?.sourceType ?? '')
        .trim()
        .toUpperCase();
      const omId = String(link?.omId ?? '').trim();
      const uf = String(link?.uf ?? '')
        .trim()
        .toUpperCase();
      if (sourceType === 'SURVEY_SCHOOLS') {
        if (omId) schoolOms.add(omId);
        if (uf) schoolUfs.add(uf);
      }
      if (sourceType === 'DOMESTIC_VIOLENCE') {
        if (omId) domesticOms.add(omId);
        if (uf) domesticUfs.add(uf);
      }
    }

    const anyResearchOms = new Set([...schoolOms, ...domesticOms]);
    const anyResearchUfs = new Set([...schoolUfs, ...domesticUfs]);
    const countIntersection = (a: Set<string>, b: Set<string>) =>
      Array.from(a).filter((item) => b.has(item)).length;
    const countDifference = (a: Set<string>, b: Set<string>) =>
      Array.from(a).filter((item) => !b.has(item)).length;

    return {
      complaintOms: complaintOms.size,
      cpcaComplaintOms: cpcaComplaintOms.size,
      smifComplaintOms: smifComplaintOms.size,
      complaintUfs: complaintUfs.size,
      schoolSurveyOms: schoolOms.size,
      schoolSurveyUfs: schoolUfs.size,
      domesticSurveyOms: domesticOms.size,
      domesticSurveyUfs: domesticUfs.size,
      complaintOmsWithAnyResearch: countIntersection(
        complaintOms,
        anyResearchOms,
      ),
      complaintUfsWithAnyResearch: countIntersection(
        complaintUfs,
        anyResearchUfs,
      ),
      complaintOmsWithoutResearch: countDifference(
        complaintOms,
        anyResearchOms,
      ),
      complaintUfsWithoutResearch: countDifference(
        complaintUfs,
        anyResearchUfs,
      ),
      cpcaComplaintOmsWithoutResearch: countDifference(
        cpcaComplaintOms,
        anyResearchOms,
      ),
      researchOmsWithoutComplaints: countDifference(
        anyResearchOms,
        complaintOms,
      ),
    };
  }

  private async listOmsForGeoMap(): Promise<StrategicGeoOmRow[]> {
    return this.prisma.om.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        uf: true,
        hasCpca: true,
        cpcaCoverageAsManaged: {
          select: {
            managerOm: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
          orderBy: {
            managerOm: {
              name: 'asc',
            },
          },
        },
      },
    });
  }

  private buildCoveredOmsCatalog(
    oms: StrategicGeoOmRow[],
  ): StrategicCoveredOmItem[] {
    return oms
      .filter(
        (om) =>
          Boolean(om.hasCpca) || (om.cpcaCoverageAsManaged?.length ?? 0) > 0,
      )
      .map((om) => ({
        id: om.id,
        code: om.code,
        name: om.name,
        uf: om.uf,
        hasCpca: om.hasCpca,
        coverageType: (om.hasCpca ? 'OWN' : 'MANAGED') as 'OWN' | 'MANAGED',
        coveredByOms: (om.cpcaCoverageAsManaged ?? []).map((entry) => ({
          id: entry.managerOm.id,
          code: entry.managerOm.code,
          name: entry.managerOm.name,
        })),
      }))
      .sort((a, b) =>
        String(a.name ?? '').localeCompare(String(b.name ?? ''), 'pt-BR', {
          sensitivity: 'base',
        }),
      );
  }

  async comgepSituationRoom() {
    const now = new Date();
    const lookbackStart = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const comgepWeights = await this.settings.getComgepScoringWeights();
    const missionMaturityFactor = 0.25;
    const openStatuses = new Set([
      'RECEIVED',
      'PROTECTION_MEASURES',
      'PRELIMINARY_ANALYSIS',
      'PROCEDURE_DEFINED',
      'INVESTIGATION',
    ]);
    const normalizeText = (value: string | null | undefined) =>
      String(value ?? '')
        .trim()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    const hasKeyword = (
      values: Array<string | null | undefined>,
      keyword: string,
    ) => values.some((value) => normalizeText(value).includes(keyword));
    const hasMilitaryLink = (value: string | null | undefined) => {
      const normalized = normalizeText(value);
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
        normalized.includes('FORCA AEREA') ||
        normalized.includes('FORCAAEREA')
      );
    };
    const createSurveyStats = () => ({
      total: 0,
      yes: 0,
      sexual: 0,
      moral: 0,
    });
    const createDomesticStats = () => ({
      total: 0,
      yes12m: 0,
      sexual: 0,
      moral: 0,
      militaryAuthor: 0,
    });
    const createComplaintStats = () => ({
      totalCases: 0,
      openCases: 0,
      retaliationCases: 0,
      stalledCases: 0,
      sexualCases: 0,
      moralCases: 0,
    });

    const [
      oms,
      complaints,
      activities,
      missions,
      surveyLinks,
      surveyRows,
      domesticLinks,
      domesticRows,
      normalizationOverview,
    ] = await Promise.all([
      this.listOmsForGeoMap(),
      (this.prisma as any).cpcComplaintCase.findMany({
        select: {
          id: true,
          caseNumber: true,
          omId: true,
          workflowScope: true,
          status: true,
          complaintType: true,
          retaliationRisk: true,
          reportedAt: true,
          updatedAt: true,
          archivedAt: true,
          om: {
            select: {
              id: true,
              code: true,
              name: true,
              uf: true,
            },
          },
        },
      }),
      this.prisma.activity.findMany({
        where: {
          eventDate: { gte: lookbackStart },
        },
        select: {
          id: true,
          title: true,
          scope: true,
          status: true,
          eventDate: true,
          locality: {
            select: {
              id: true,
              name: true,
              uf: true,
            },
          },
          report: {
            select: {
              id: true,
              signedAt: true,
            },
          },
        },
      }),
      (this.prisma as any).mission.findMany({
        where: {
          startDate: { gte: lookbackStart },
        },
        select: {
          id: true,
          title: true,
          scope: true,
          startDate: true,
          locality: {
            select: {
              id: true,
              name: true,
              uf: true,
            },
          },
        },
      }),
      this.prisma.biNormalizationLink.findMany({
        where: {
          sourceType: 'SURVEY_SCHOOLS',
          status: { in: ['MATCHED', 'UF_ONLY'] },
        },
        select: {
          sourceRecordId: true,
          omId: true,
          uf: true,
          status: true,
          om: {
            select: {
              uf: true,
            },
          },
        },
      }),
      this.prisma.biSurveyResponse.findMany({
        select: {
          id: true,
          sufferedViolence: true,
          violenceTypes: true,
        },
      }),
      this.prisma.biNormalizationLink.findMany({
        where: {
          sourceType: 'DOMESTIC_VIOLENCE',
          status: { in: ['MATCHED', 'UF_ONLY'] },
        },
        select: {
          sourceRecordId: true,
          omId: true,
          uf: true,
          status: true,
        },
      }),
      this.prisma.biDomesticViolenceResponse.findMany({
        select: {
          id: true,
          sufferedLast12Months: true,
          violenceTypes: true,
          authorMilitaryLink: true,
        },
      }),
      this.biNormalization.overview(),
    ]);

    const coveredOmIds = new Set(
      this.buildCoveredOmsCatalog(oms).map((item) => String(item.id)),
    );
    const ufSet = new Set<string>();

    const ensureUf = (uf: string | null | undefined) => {
      const value = String(uf ?? '')
        .trim()
        .toUpperCase();
      if (value) ufSet.add(value);
      return value;
    };
    const linkUf = (link: any) => ensureUf(link?.uf ?? link?.om?.uf);

    const surveyById = new Map<
      string,
      {
        sufferedViolence: boolean;
        sexual: boolean;
        moral: boolean;
      }
    >(
      (surveyRows as any[]).map((row: any) => [
        String(row.id),
        {
          sufferedViolence: row.sufferedViolence === true,
          sexual: hasKeyword(row.violenceTypes ?? [], 'SEXUAL'),
          moral: hasKeyword(row.violenceTypes ?? [], 'MORAL'),
        },
      ]),
    );
    const domesticById = new Map<
      string,
      {
        sufferedLast12Months: boolean;
        sexual: boolean;
        moral: boolean;
        militaryAuthor: boolean;
      }
    >(
      (domesticRows as any[]).map((row: any) => [
        String(row.id),
        {
          sufferedLast12Months: row.sufferedLast12Months === true,
          sexual: hasKeyword(row.violenceTypes ?? [], 'SEXUAL'),
          moral: hasKeyword(row.violenceTypes ?? [], 'MORAL'),
          militaryAuthor: hasMilitaryLink(row.authorMilitaryLink),
        },
      ]),
    );

    const surveySignalsByUf = new Map<
      string,
      ReturnType<typeof createSurveyStats>
    >();
    const surveySignalsByOm = new Map<
      string,
      ReturnType<typeof createSurveyStats>
    >();
    for (const link of surveyLinks) {
      const response = surveyById.get(String(link.sourceRecordId));
      if (!response) continue;
      const uf = linkUf(link);
      if (uf) {
        const current = surveySignalsByUf.get(uf) ?? createSurveyStats();
        current.total += 1;
        if (response.sufferedViolence) {
          current.yes += 1;
          if (response.sexual) current.sexual += 1;
          if (response.moral) current.moral += 1;
        }
        surveySignalsByUf.set(uf, current);
      }
      const omId = String(link.omId ?? '').trim();
      if (omId) {
        const current = surveySignalsByOm.get(omId) ?? createSurveyStats();
        current.total += 1;
        if (response.sufferedViolence) {
          current.yes += 1;
          if (response.sexual) current.sexual += 1;
          if (response.moral) current.moral += 1;
        }
        surveySignalsByOm.set(omId, current);
      }
    }

    const domesticSignalsByUf = new Map<
      string,
      ReturnType<typeof createDomesticStats>
    >();
    const domesticSignalsByOm = new Map<
      string,
      ReturnType<typeof createDomesticStats>
    >();
    for (const link of domesticLinks) {
      const response = domesticById.get(String(link.sourceRecordId));
      if (!response) continue;
      const uf = linkUf(link);
      if (uf) {
        const current = domesticSignalsByUf.get(uf) ?? createDomesticStats();
        current.total += 1;
        if (response.sufferedLast12Months) {
          current.yes12m += 1;
          if (response.sexual) current.sexual += 1;
          if (response.moral) current.moral += 1;
          if (response.militaryAuthor) current.militaryAuthor += 1;
        }
        domesticSignalsByUf.set(uf, current);
      }
      const omId = String(link.omId ?? '').trim();
      if (omId) {
        const current = domesticSignalsByOm.get(omId) ?? createDomesticStats();
        current.total += 1;
        if (response.sufferedLast12Months) {
          current.yes12m += 1;
          if (response.sexual) current.sexual += 1;
          if (response.moral) current.moral += 1;
          if (response.militaryAuthor) current.militaryAuthor += 1;
        }
        domesticSignalsByOm.set(omId, current);
      }
    }

    const complaintsByUf = new Map<
      string,
      {
        totalCases: number;
        openCases: number;
        retaliationCases: number;
        stalledCases: number;
        sexualCases: number;
      }
    >();
    const complaintsByOm = new Map<
      string,
      {
        totalCases: number;
        openCases: number;
        retaliationCases: number;
        stalledCases: number;
        sexualCases: number;
      }
    >();

    for (const item of complaints as any[]) {
      const omId = String(item?.omId ?? '').trim();
      const omUf = ensureUf(item?.om?.uf);
      if (!omId || !omUf) continue;

      const isOpen = openStatuses.has(String(item?.status ?? '').trim());
      const openDays = isOpen
        ? Math.max(
            0,
            Math.floor(
              (now.getTime() - new Date(item.reportedAt).getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          )
        : 0;

      const applyStats = (map: Map<string, any>, key: string) => {
        const current = map.get(key) ?? createComplaintStats();
        current.totalCases += 1;
        if (isOpen) {
          current.openCases += 1;
          if (openDays > 30) current.stalledCases += 1;
          if (item?.retaliationRisk) current.retaliationCases += 1;
        }
        if (
          String(item?.complaintType ?? '')
            .trim()
            .toUpperCase() === 'SEXUAL'
        ) {
          current.sexualCases += 1;
        } else if (
          String(item?.complaintType ?? '')
            .trim()
            .toUpperCase() === 'MORAL'
        ) {
          current.moralCases += 1;
        }
        map.set(key, current);
      };

      applyStats(complaintsByUf, omUf);
      applyStats(complaintsByOm, omId);
    }

    const presenceByUf = new Map<
      string,
      {
        missions: number;
        completedActivities: number;
        signedReports: number;
      }
    >();

    for (const activity of activities) {
      const uf = ensureUf(activity.locality?.uf);
      if (!uf) continue;
      const current = presenceByUf.get(uf) ?? {
        missions: 0,
        completedActivities: 0,
        signedReports: 0,
      };
      if (
        String(activity.status ?? '')
          .trim()
          .toUpperCase() === 'DONE'
      ) {
        current.completedActivities += 1;
      }
      if (activity.report?.signedAt) {
        current.signedReports += 1;
      }
      presenceByUf.set(uf, current);
    }

    for (const mission of missions as any[]) {
      const uf = ensureUf(mission?.locality?.uf);
      if (!uf) continue;
      const current = presenceByUf.get(uf) ?? {
        missions: 0,
        completedActivities: 0,
        signedReports: 0,
      };
      current.missions += 1;
      presenceByUf.set(uf, current);
    }

    const omsByUf = new Map<string, StrategicGeoOmRow[]>();
    for (const om of oms) {
      const uf = ensureUf(om.uf);
      if (!uf) continue;
      const current = omsByUf.get(uf) ?? [];
      current.push(om);
      omsByUf.set(uf, current);
    }

    const omRiskRows = oms
      .map((om: StrategicGeoOmRow) => {
        const survey = surveySignalsByOm.get(om.id) ?? createSurveyStats();
        const domestic =
          domesticSignalsByOm.get(om.id) ?? createDomesticStats();
        const complaintsStats =
          complaintsByOm.get(om.id) ?? createComplaintStats();
        const ufPresence = presenceByUf.get(ensureUf(om.uf)) ?? {
          missions: 0,
          completedActivities: 0,
          signedReports: 0,
        };
        const surveyRate =
          survey.total > 0 ? (survey.yes / survey.total) * 100 : 0;
        const domesticRate =
          domestic.total > 0 ? (domestic.yes12m / domestic.total) * 100 : 0;
        const surveyEvidence = this.buildEvidenceSummary(
          survey.total,
          survey.yes,
        );
        const domesticEvidence = this.buildEvidenceSummary(
          domestic.total,
          domestic.yes12m,
        );
        const sexualSignals = survey.sexual + domestic.sexual;
        const moralSignals = survey.moral + domestic.moral;
        const researchSignals = survey.yes + domestic.yes12m;
        const researchTotal = survey.total + domestic.total;
        const underreport = this.buildUnderreportEstimate({
          basis: 'OM',
          researchTotal,
          signalCount: researchSignals,
          formalCases: complaintsStats.totalCases,
        });
        const covered = coveredOmIds.has(om.id);
        const rawRisk =
          complaintsStats.openCases * comgepWeights.riskOpenCases +
          complaintsStats.retaliationCases *
            comgepWeights.riskRetaliationCases +
          complaintsStats.stalledCases * comgepWeights.riskStalledCases +
          complaintsStats.sexualCases * comgepWeights.riskSexualFormalCases +
          surveyEvidence.adjustedRate * comgepWeights.riskSurveyRate +
          domesticEvidence.adjustedRate * comgepWeights.riskDomesticRate +
          sexualSignals * comgepWeights.riskSexualSignals +
          moralSignals * comgepWeights.riskMoralSignals +
          domestic.militaryAuthor * comgepWeights.riskMilitaryAuthor +
          (underreport.eligible
            ? underreport.percent * comgepWeights.riskUnderreportPercent
            : 0) +
          (covered ? 0 : comgepWeights.riskUncoveredOmPenalty);
        const rankingReasons: string[] = [];
        if (survey.sexual > 0) {
          rankingReasons.push(
            `${survey.sexual} relato(s) sexual(is) na pesquisa de escolas`,
          );
        }
        if (domestic.sexual > 0) {
          rankingReasons.push(
            `${domestic.sexual} relato(s) sexual(is) na pesquisa de violência doméstica`,
          );
        }
        if (survey.moral > 0) {
          rankingReasons.push(
            `${survey.moral} relato(s) moral(is) na pesquisa de escolas`,
          );
        }
        if (domestic.moral > 0) {
          rankingReasons.push(
            `${domestic.moral} relato(s) moral(is) na pesquisa de violência doméstica`,
          );
        }
        if (domestic.yes12m > 0) {
          rankingReasons.push(
            `${domestic.yes12m} relato(s) de violência doméstica nos últimos 12 meses`,
          );
        }
        if (domestic.militaryAuthor > 0) {
          rankingReasons.push(
            `${domestic.militaryAuthor} relato(s) com autor vinculado ao meio militar`,
          );
        }
        if (complaintsStats.openCases > 0) {
          rankingReasons.push(
            `${complaintsStats.openCases} denúncia(s) formal(is) aberta(s)`,
          );
        }
        if (complaintsStats.retaliationCases > 0) {
          rankingReasons.push(
            `${complaintsStats.retaliationCases} caso(s) com risco de retaliação`,
          );
        }
        if (complaintsStats.stalledCases > 0) {
          rankingReasons.push(
            `${complaintsStats.stalledCases} caso(s) além do prazo`,
          );
        }
        if (underreport.eligible && underreport.percent >= 40) {
          rankingReasons.push(
            `subnotificação estimada em ${underreport.percent.toFixed(1)}%`,
          );
        } else if (researchTotal === 0 && complaintsStats.totalCases > 0) {
          rankingReasons.push(
            'há denúncia formal, mas não há pesquisa normalizada para comparação nesta OM',
          );
        } else if (researchTotal > 0 && researchTotal < 10) {
          rankingReasons.push(
            'base de pesquisa pequena; usada apenas como sinal auxiliar',
          );
        }
        if (!covered) {
          rankingReasons.push('sem cobertura CPCA');
        }
        if (
          (ufPresence.missions ?? 0) +
            (ufPresence.completedActivities ?? 0) +
            (ufPresence.signedReports ?? 0) ===
          0
        ) {
          rankingReasons.push('sem presença operacional recente na UF');
        }
        let recommendedAction =
          'Monitorar a OM e manter presença institucional na UF.';
        if (
          domestic.militaryAuthor > 0 ||
          sexualSignals > 0 ||
          moralSignals > 0
        ) {
          recommendedAction =
            'Priorizar escuta qualificada, palestras e atividades de campo voltadas à prevenção.';
        }
        if (
          complaintsStats.openCases > 0 ||
          complaintsStats.retaliationCases > 0
        ) {
          recommendedAction =
            'Atuação imediata da comissão, com acompanhamento do passivo formal e reforço de presença institucional.';
        }
        if (
          underreport.eligible &&
          underreport.percent >= 60 &&
          complaintsStats.totalCases === 0
        ) {
          recommendedAction =
            'Alta chance de subnotificação: priorizar escuta protegida, divulgação de canais e ações presenciais na OM.';
        }

        return {
          id: om.id,
          code: om.code,
          name: om.name,
          uf: om.uf,
          covered,
          coverageType: covered
            ? om.hasCpca
              ? 'CPCA próprio'
              : 'Coberta por outra OM'
            : 'Sem cobertura',
          surveyRate: Number(surveyRate.toFixed(1)),
          domesticRate: Number(domesticRate.toFixed(1)),
          surveyAdjustedRate: surveyEvidence.adjustedRate,
          domesticAdjustedRate: domesticEvidence.adjustedRate,
          surveyEvidence,
          domesticEvidence,
          surveySignals: survey,
          domesticSignals: domestic,
          signalsBySource: {
            schools: {
              total: survey.total,
              yes: survey.yes,
              sexual: survey.sexual,
              moral: survey.moral,
            },
            domestic: {
              total: domestic.total,
              last12Months: domestic.yes12m,
              sexual: domestic.sexual,
              moral: domestic.moral,
              militaryAuthor: domestic.militaryAuthor,
            },
          },
          researchSignals,
          sexualSignals,
          moralSignals,
          underreport,
          operationalPresence: ufPresence,
          complaints: complaintsStats,
          rawRisk,
          rankingReasons,
          recommendedAction,
          link: `/cpca-cases?omId=${encodeURIComponent(om.id)}`,
        };
      })
      .sort((a: any, b: any) => b.rawRisk - a.rawRisk);

    const maxOmRisk = Math.max(
      ...omRiskRows.map((item: any) => item.rawRisk),
      1,
    );
    const omRiskRowsWithScore = omRiskRows.map((item: any) => ({
      ...item,
      riskScore: Math.round((item.rawRisk / maxOmRisk) * 100),
    }));

    const ufRowsRaw = Array.from(ufSet)
      .map((uf) => {
        const ufOms = omsByUf.get(uf) ?? [];
        const totalOms = ufOms.length;
        const coveredOms = ufOms.filter((om) => coveredOmIds.has(om.id)).length;
        const complaintsStats =
          complaintsByUf.get(uf) ?? createComplaintStats();
        const survey = surveySignalsByUf.get(uf) ?? createSurveyStats();
        const domestic = domesticSignalsByUf.get(uf) ?? createDomesticStats();
        const presence = presenceByUf.get(uf) ?? {
          missions: 0,
          completedActivities: 0,
          signedReports: 0,
        };

        const surveyRate =
          survey.total > 0 ? (survey.yes / survey.total) * 100 : 0;
        const domesticRate =
          domestic.total > 0 ? (domestic.yes12m / domestic.total) * 100 : 0;
        const surveyEvidence = this.buildEvidenceSummary(
          survey.total,
          survey.yes,
        );
        const domesticEvidence = this.buildEvidenceSummary(
          domestic.total,
          domestic.yes12m,
        );
        const sexualSignals = survey.sexual + domestic.sexual;
        const moralSignals = survey.moral + domestic.moral;
        const researchSignals = survey.yes + domestic.yes12m;
        const researchTotal = survey.total + domestic.total;
        const underreport = this.buildUnderreportEstimate({
          basis: 'UF',
          researchTotal,
          signalCount: researchSignals,
          formalCases: complaintsStats.totalCases,
        });
        const coveragePercent =
          totalOms > 0 ? Number(((coveredOms / totalOms) * 100).toFixed(1)) : 0;

        const rawRisk =
          complaintsStats.openCases * comgepWeights.riskOpenCases +
          complaintsStats.retaliationCases *
            comgepWeights.riskRetaliationCases +
          complaintsStats.stalledCases * comgepWeights.riskStalledCases +
          complaintsStats.sexualCases * comgepWeights.riskSexualFormalCases +
          surveyEvidence.adjustedRate * comgepWeights.riskSurveyRate +
          domesticEvidence.adjustedRate * comgepWeights.riskDomesticRate +
          sexualSignals * comgepWeights.riskSexualSignals +
          moralSignals * comgepWeights.riskMoralSignals +
          domestic.militaryAuthor * comgepWeights.riskMilitaryAuthor +
          (underreport.eligible
            ? underreport.percent * comgepWeights.riskUnderreportPercent
            : 0);
        const rawPresence =
          presence.missions *
            comgepWeights.presenceMissions *
            missionMaturityFactor +
          presence.completedActivities *
            comgepWeights.presenceCompletedActivities +
          presence.signedReports * comgepWeights.presenceSignedReports;

        return {
          uf,
          totalOms,
          coveredOms,
          uncoveredOms: Math.max(totalOms - coveredOms, 0),
          coveragePercent,
          surveyRate: Number(surveyRate.toFixed(1)),
          domesticRate: Number(domesticRate.toFixed(1)),
          surveyAdjustedRate: surveyEvidence.adjustedRate,
          domesticAdjustedRate: domesticEvidence.adjustedRate,
          surveyEvidence,
          domesticEvidence,
          surveySignals: survey,
          domesticSignals: domestic,
          signalsBySource: {
            schools: {
              total: survey.total,
              yes: survey.yes,
              sexual: survey.sexual,
              moral: survey.moral,
            },
            domestic: {
              total: domestic.total,
              last12Months: domestic.yes12m,
              sexual: domestic.sexual,
              moral: domestic.moral,
              militaryAuthor: domestic.militaryAuthor,
            },
          },
          researchSignals,
          sexualSignals,
          moralSignals,
          underreport,
          complaints: complaintsStats,
          presence,
          presenceMaturity: {
            missionMaturityFactor,
            note: 'Missões contam como presença inicial e são amortecidas no score para não virarem projeção determinística.',
          },
          rawRisk,
          rawPresence,
          oms: omRiskRowsWithScore
            .filter(
              (item: any) =>
                String(item.uf ?? '')
                  .trim()
                  .toUpperCase() === uf,
            )
            .slice(0, 12),
        };
      })
      .filter((row: any) => row.totalOms > 0)
      .sort((a: any, b: any) => b.rawRisk - a.rawRisk);

    const maxUfRisk = Math.max(
      ...ufRowsRaw.map((item: any) => item.rawRisk),
      1,
    );
    const maxUfPresence = Math.max(
      ...ufRowsRaw.map((item: any) => item.rawPresence),
      1,
    );

    const ufRows = ufRowsRaw.map((item: any) => {
      const riskScore = Math.round((item.rawRisk / maxUfRisk) * 100);
      const presenceScore = Math.round(
        (item.rawPresence / maxUfPresence) * 100,
      );
      let priorityBand = 'ESTÁVEL';
      if (
        riskScore >= 70 &&
        (item.coveragePercent < 80 || presenceScore < 45)
      ) {
        priorityBand = 'CRÍTICA';
      } else if (riskScore >= 60) {
        priorityBand = 'ALTA';
      } else if (riskScore >= 40 || item.coveragePercent < 70) {
        priorityBand = 'ATENÇÃO';
      }

      let recommendedFocus = 'Monitorar cenário e manter rotina de presença.';
      if (item.coveragePercent < 70) {
        recommendedFocus =
          'Expandir cobertura CPCA e revisar governança local.';
      } else if (presenceScore < 40) {
        recommendedFocus = 'Reforçar presença operacional na UF.';
      } else if (riskScore >= 70) {
        recommendedFocus = 'Priorizar intervenção imediata de comando.';
      }
      if (
        item.underreport?.eligible &&
        item.underreport?.percent >= 50 &&
        Number(item.complaints?.totalCases ?? 0) === 0
      ) {
        recommendedFocus =
          'Há sinal forte de subnotificação: priorizar escuta protegida, palestras e presença institucional na UF.';
      } else if (
        Number(item.domesticSignals?.militaryAuthor ?? 0) > 0 ||
        Number(item.sexualSignals ?? 0) > 0 ||
        Number(item.moralSignals ?? 0) > 0
      ) {
        recommendedFocus =
          'Priorizar presença qualificada com palestras e atividades de campo focadas em prevenção e canais de denúncia.';
      }
      const rankingReasons: string[] = [];
      if (item.signalsBySource?.schools?.sexual > 0) {
        rankingReasons.push(
          `${item.signalsBySource.schools.sexual} relato(s) sexual(is) na pesquisa de escolas`,
        );
      }
      if (item.signalsBySource?.domestic?.sexual > 0) {
        rankingReasons.push(
          `${item.signalsBySource.domestic.sexual} relato(s) sexual(is) na pesquisa de violência doméstica`,
        );
      }
      if (item.signalsBySource?.schools?.moral > 0) {
        rankingReasons.push(
          `${item.signalsBySource.schools.moral} relato(s) moral(is) na pesquisa de escolas`,
        );
      }
      if (item.signalsBySource?.domestic?.moral > 0) {
        rankingReasons.push(
          `${item.signalsBySource.domestic.moral} relato(s) moral(is) na pesquisa de violência doméstica`,
        );
      }
      if (item.domesticSignals?.yes12m > 0) {
        rankingReasons.push(
          `${item.domesticSignals.yes12m} relato(s) de violência doméstica em 12 meses`,
        );
      }
      if (item.domesticSignals?.militaryAuthor > 0) {
        rankingReasons.push(
          `${item.domesticSignals.militaryAuthor} relato(s) com autor militar`,
        );
      }
      if (item.complaints?.openCases > 0) {
        rankingReasons.push(
          `${item.complaints.openCases} denúncia(s) formal(is) aberta(s)`,
        );
      }
      if (item.underreport?.eligible && item.underreport?.percent >= 40) {
        rankingReasons.push(
          `subnotificação estimada em ${Number(item.underreport.percent).toFixed(1)}%`,
        );
      } else if (
        Number(item.complaints?.totalCases ?? 0) > 0 &&
        Number(item.underreport?.researchTotal ?? 0) === 0
      ) {
        rankingReasons.push(
          'há denúncia formal na UF, mas não há pesquisa normalizada para comparação',
        );
      } else if (
        Number(item.underreport?.researchTotal ?? 0) > 0 &&
        Number(item.underreport?.researchTotal ?? 0) < 10
      ) {
        rankingReasons.push(
          'base de pesquisa pequena; usada apenas como sinal auxiliar',
        );
      }
      if (
        (item.presence?.missions ?? 0) +
          (item.presence?.completedActivities ?? 0) ===
        0
      ) {
        rankingReasons.push('presença operacional baixa ou ausente');
      }

      return {
        ...item,
        riskScore,
        presenceScore,
        priorityBand,
        recommendedFocus,
        pressureScore: riskScore - presenceScore,
        rankingReasons,
      };
    });

    const criticalUfRows = ufRows
      .filter((item: any) => item.priorityBand !== 'ESTÁVEL')
      .sort((a: any, b: any) => b.riskScore - a.riskScore)
      .slice(0, 8);
    const topRiskOms = omRiskRowsWithScore.slice(0, 12);
    const coverageGaps = omRiskRowsWithScore
      .filter((item: any) => !item.covered)
      .slice(0, 12);
    const operationalPressure = ufRows
      .map((item: any) => ({
        ...item,
      }))
      .sort((a: any, b: any) => b.pressureScore - a.pressureScore)
      .slice(0, 10);

    return {
      generatedAt: now.toISOString(),
      lookbackDays: 180,
      summary: {
        totalOms: oms.length,
        coveredOms: Array.from(coveredOmIds).length,
        coveredOmsPercent:
          oms.length > 0
            ? Number(((coveredOmIds.size / oms.length) * 100).toFixed(1))
            : 0,
        criticalUfCount: ufRows.filter(
          (item: any) => item.priorityBand === 'CRÍTICA',
        ).length,
        highRiskOmCount: omRiskRowsWithScore.filter(
          (item: any) => item.riskScore >= 70,
        ).length,
        openComplaintCases: Array.from(complaintsByUf.values()).reduce(
          (acc: number, item: any) => acc + item.openCases,
          0,
        ),
        operationalPresenceEvents: Array.from(presenceByUf.values()).reduce(
          (acc: number, item: any) =>
            acc + item.missions + item.completedActivities + item.signedReports,
          0,
        ),
        researchComparableOmCount: omRiskRowsWithScore.filter(
          (item: any) => Number(item?.underreport?.researchTotal ?? 0) >= 10,
        ).length,
        complaintOmsWithoutResearchCount: omRiskRowsWithScore.filter(
          (item: any) =>
            Number(item?.complaints?.totalCases ?? 0) > 0 &&
            String(item?.underreport?.status ?? '') === 'NO_RESEARCH',
        ).length,
        missionMaturityFactor,
      },
      dataConfidence: {
        supportedCoveragePercent:
          normalizationOverview?.overall?.supportedCoveragePercent ?? 0,
        totalRecords: normalizationOverview?.overall?.totalRecords ?? 0,
        matched: normalizationOverview?.overall?.matched ?? 0,
        ufOnly: normalizationOverview?.overall?.ufOnly ?? 0,
        notFound: normalizationOverview?.overall?.notFound ?? 0,
        lastUpdatedAt: normalizationOverview?.lastUpdatedAt ?? null,
        sources: normalizationOverview?.sources ?? [],
      },
      matrix: {
        items: ufRows,
      },
      details: {
        coveredOms: omRiskRowsWithScore
          .filter((item: any) => item.covered)
          .sort((a: any, b: any) => {
            if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
            return String(a.code ?? '').localeCompare(
              String(b.code ?? ''),
              'pt-BR',
              {
                sensitivity: 'base',
              },
            );
          }),
        criticalUfs: ufRows
          .filter((item: any) => item.priorityBand !== 'ESTÁVEL')
          .sort((a: any, b: any) => b.riskScore - a.riskScore),
        highRiskOms: omRiskRowsWithScore.filter(
          (item: any) => item.riskScore >= 70,
        ),
        operationalPresenceByUf: ufRows
          .map((item: any) => ({
            uf: item.uf,
            priorityBand: item.priorityBand,
            presenceScore: item.presenceScore,
            riskScore: item.riskScore,
            coveragePercent: item.coveragePercent,
            recommendedFocus: item.recommendedFocus,
            missions: item.presence?.missions ?? 0,
            completedActivities: item.presence?.completedActivities ?? 0,
            signedReports: item.presence?.signedReports ?? 0,
            totalEvents:
              (item.presence?.missions ?? 0) +
              (item.presence?.completedActivities ?? 0) +
              (item.presence?.signedReports ?? 0),
          }))
          .sort((a: any, b: any) => b.totalEvents - a.totalEvents),
        uncoveredOms: omRiskRowsWithScore
          .filter((item: any) => !item.covered)
          .sort((a: any, b: any) => {
            if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
            return String(a.code ?? '').localeCompare(
              String(b.code ?? ''),
              'pt-BR',
              {
                sensitivity: 'base',
              },
            );
          }),
        omRiskIndex: omRiskRowsWithScore,
        ufMatrix: ufRows,
      },
      watchlists: {
        criticalUfs: criticalUfRows,
        topRiskOms,
        coverageGaps,
        operationalPressure,
      },
    };
  }

  async listComgepRecommendations(limit = 8) {
    const take = Math.max(1, Math.min(50, Number(limit) || 8));
    const items = await (this.prisma as any).strategicRecommendation.findMany({
      orderBy: [{ createdAt: 'desc' }],
      take,
      include: {
        om: {
          select: {
            id: true,
            code: true,
            name: true,
            uf: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      items: items.map((item: any) => ({
        ...item,
        evidenceCount: Array.isArray(item.evidenceJson)
          ? item.evidenceJson.length
          : 0,
      })),
    };
  }

  async createComgepRecommendation(
    payload: {
      title: string;
      summary: string;
      sessionId?: string | null;
      sourceAgentType: string;
      mode: string;
      focusType?: string | null;
      focusLabel?: string | null;
      uf?: string | null;
      omId?: string | null;
      evidence?: unknown;
    },
    user?: RbacUser,
  ) {
    const title = String(payload.title ?? '').trim();
    const summary = this.normalizeStrategicRecommendationText(payload.summary);
    if (!title) {
      throw new BadRequestException('Título da recomendação não informado.');
    }
    if (!summary) {
      throw new BadRequestException('Resumo da recomendação não informado.');
    }

    const omId = String(payload.omId ?? '').trim() || null;
    if (omId) {
      const om = await this.prisma.om.findUnique({
        where: { id: omId },
        select: { id: true },
      });
      if (!om) {
        throw new NotFoundException('OM da recomendação não encontrada.');
      }
    }

    const created = await (this.prisma as any).strategicRecommendation.create({
      data: {
        title,
        summary,
        sessionId: String(payload.sessionId ?? '').trim() || null,
        sourceAgentType:
          String(payload.sourceAgentType ?? '').trim() || 'briefing_comgep',
        mode: String(payload.mode ?? '').trim() || 'executive',
        focusType: String(payload.focusType ?? '').trim() || null,
        focusLabel: String(payload.focusLabel ?? '').trim() || null,
        uf:
          String(payload.uf ?? '')
            .trim()
            .toUpperCase() || null,
        omId,
        evidenceJson:
          payload.evidence && typeof payload.evidence === 'object'
            ? (payload.evidence as any)
            : null,
        createdById: String(user?.id ?? '').trim() || null,
      },
      include: {
        om: {
          select: {
            id: true,
            code: true,
            name: true,
            uf: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      ...created,
      evidenceCount: Array.isArray(created.evidenceJson)
        ? created.evidenceJson.length
        : 0,
    };
  }

  private normalizeStrategicRecommendationText(value: unknown) {
    return String(value ?? '')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  async situationalDashboard(filters?: StrategicSourceFilter) {
    const sourceSet = this.resolveSourceSet(filters?.sources);
    const [
      surveyData,
      domesticViolenceData,
      recruitsData,
      complaintsData,
      activitiesData,
      missionsData,
      tasksData,
      crossSourceCoverage,
      localities,
    ] = await Promise.all([
      this.getSurveyKpis({ sources: Array.from(sourceSet) }),
      this.getDomesticViolenceKpis({ sources: Array.from(sourceSet) }),
      this.getRecruitsKpis({ sources: Array.from(sourceSet) }),
      this.getComplaintsKpis({ sources: Array.from(sourceSet) }),
      this.getActivitiesKpis({ sources: Array.from(sourceSet) }),
      this.getMissionsKpis({ sources: Array.from(sourceSet) }),
      this.getTaskKpis({ sources: Array.from(sourceSet) }),
      this.getCrossSourceCoverage(),
      this.prisma.locality.findMany({
        select: { id: true, code: true, name: true },
      }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      surveys: surveyData,
      domesticViolence: domesticViolenceData,
      recruits: recruitsData,
      complaints: complaintsData,
      activities: activitiesData,
      missions: missionsData,
      tasks: tasksData,
      crossSourceCoverage,
      localityCount: localities.length,
    };
  }

  async geoMap(filters?: StrategicSourceFilter) {
    const sourceSet = this.resolveSourceSet(filters?.sources);
    const includeComplaints = this.hasComplaintSources(sourceSet);
    const includeActivities = this.hasActivitySource(sourceSet);
    const includeMissions = this.hasMissionSource(sourceSet);
    const includeSurveySchools = this.hasSurveySources(sourceSet);
    const includeDomesticViolence = this.hasDomesticViolenceSources(sourceSet);
    if (
      !includeComplaints &&
      !includeActivities &&
      !includeMissions &&
      !includeSurveySchools &&
      !includeDomesticViolence
    ) {
      const [localities, oms] = await Promise.all([
        this.prisma.locality.findMany({
          select: {
            id: true,
            code: true,
            name: true,
            uf: true,
            catalogType: true,
          },
        }),
        this.listOmsForGeoMap(),
      ]);
      const localitiesCatalog = [...localities].sort((a, b) =>
        String(a.name ?? '').localeCompare(String(b.name ?? ''), 'pt-BR', {
          sensitivity: 'base',
        }),
      );
      const omsCatalog = [...oms].sort((a, b) =>
        String(a.name ?? '').localeCompare(String(b.name ?? ''), 'pt-BR', {
          sensitivity: 'base',
        }),
      );
      const coveredOmsCatalog = this.buildCoveredOmsCatalog(oms);
      return {
        generatedAt: new Date().toISOString(),
        states: [],
        totalLocalitiesWithUf: localities.filter((l) => l.uf).length,
        totalLocalitiesWithCpca: oms.filter((om) => om.hasCpca).length,
        totalOmsCoveredByCpca: coveredOmsCatalog.length,
        totalLocalities: localities.length,
        localitiesCatalog,
        omsCatalog,
        cpcaCoveredOmsCatalog: coveredOmsCatalog,
      };
    }

    const complaintScopes = this.buildComplaintScopeFilter(sourceSet);
    const activityScope = this.buildActivityScopeFilter(sourceSet);
    const [localities, oms] = await Promise.all([
      this.prisma.locality.findMany({
        select: {
          id: true,
          code: true,
          name: true,
          uf: true,
          catalogType: true,
        },
      }),
      this.listOmsForGeoMap(),
    ]);
    const localitiesCatalog = [...localities].sort((a, b) =>
      String(a.name ?? '').localeCompare(String(b.name ?? ''), 'pt-BR', {
        sensitivity: 'base',
      }),
    );
    const omsCatalog = [...oms].sort((a, b) =>
      String(a.name ?? '').localeCompare(String(b.name ?? ''), 'pt-BR', {
        sensitivity: 'base',
      }),
    );
    const coveredOmsCatalog = this.buildCoveredOmsCatalog(oms);

    const [
      complaints,
      activities,
      missions,
      surveyLinks,
      surveyRows,
      domesticLinks,
      domesticRows,
    ] = await Promise.all([
      includeComplaints
        ? (this.prisma as any).cpcComplaintCase.findMany({
            where:
              complaintScopes.length > 0
                ? { workflowScope: { in: complaintScopes } }
                : undefined,
            select: {
              omId: true,
              caseNumber: true,
              complaintType: true,
              status: true,
              reportedAt: true,
              workflowScope: true,
              om: { select: { code: true, name: true } },
            },
          })
        : Promise.resolve([]),
      includeActivities
        ? this.prisma.activity.findMany({
            where: activityScope ? { scope: activityScope } : undefined,
            select: {
              localityId: true,
              title: true,
              scope: true,
              status: true,
              eventDate: true,
              locality: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
      includeMissions
        ? (this.prisma as any).mission.findMany({
            select: {
              localityId: true,
              title: true,
              scope: true,
              startDate: true,
              endDate: true,
              locality: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
      includeSurveySchools
        ? this.prisma.biNormalizationLink.findMany({
            where: {
              sourceType: 'SURVEY_SCHOOLS',
              status: { in: ['MATCHED', 'UF_ONLY'] },
            },
            select: {
              sourceRecordId: true,
              uf: true,
              om: {
                select: {
                  uf: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      includeSurveySchools
        ? (this.prisma as any).biSurveyResponse.findMany({
            select: {
              id: true,
              sufferedViolence: true,
            },
          })
        : Promise.resolve([]),
      includeDomesticViolence
        ? this.prisma.biNormalizationLink.findMany({
            where: {
              sourceType: 'DOMESTIC_VIOLENCE',
              status: { in: ['MATCHED', 'UF_ONLY'] },
            },
            select: {
              sourceRecordId: true,
              uf: true,
              om: {
                select: {
                  uf: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      includeDomesticViolence
        ? (this.prisma as any).biDomesticViolenceResponse.findMany({
            select: {
              id: true,
              sufferedLast12Months: true,
            },
          })
        : Promise.resolve([]),
    ]);

    type StateEntry = {
      uf: string;
      complaints: number;
      cpcaComplaints: number;
      smifComplaints: number;
      openComplaints: number;
      cpcaOpenComplaints: number;
      smifOpenComplaints: number;
      activities: number;
      missions: number;
      schoolSurveyTotal: number;
      schoolSurveyYes: number;
      domesticSurveyTotal: number;
      domesticLast12MonthsYes: number;
      researchSignals: number;
      pressureScore: number;
      responseScore: number;
      hasResearch: boolean;
      localities: string[];
      oms: string[];
      smifLocalities: string[];
      cipavdLocalities: string[];
      localitiesCombined: string[];
      complaintDetails: {
        caseNumber: string;
        type: string;
        status: string;
        date: string;
        locality: string;
        scope: string;
      }[];
      activityDetails: {
        title: string;
        scope: string;
        status: string;
        date: string;
        locality: string;
      }[];
      missionDetails: {
        title: string;
        scope: string;
        startDate: string;
        endDate: string;
        locality: string;
      }[];
    };

    const ufMap = new Map<string, StateEntry>();

    const locUfMap = new Map<string, string>();
    for (const loc of localities) {
      if (loc.uf) locUfMap.set(loc.id, loc.uf);
    }
    const omUfMap = new Map<string, string>();
    for (const om of oms) {
      if (om.uf) omUfMap.set(om.id, om.uf);
    }

    const ensureUf = (uf: string): StateEntry => {
      if (!ufMap.has(uf)) {
        ufMap.set(uf, {
          uf,
          complaints: 0,
          cpcaComplaints: 0,
          smifComplaints: 0,
          openComplaints: 0,
          cpcaOpenComplaints: 0,
          smifOpenComplaints: 0,
          activities: 0,
          missions: 0,
          schoolSurveyTotal: 0,
          schoolSurveyYes: 0,
          domesticSurveyTotal: 0,
          domesticLast12MonthsYes: 0,
          researchSignals: 0,
          pressureScore: 0,
          responseScore: 0,
          hasResearch: false,
          localities: [],
          oms: [],
          smifLocalities: [],
          cipavdLocalities: [],
          localitiesCombined: [],
          complaintDetails: [],
          activityDetails: [],
          missionDetails: [],
        });
      }
      return ufMap.get(uf)!;
    };

    const pushUniqueLocality = (target: string[], name: string) => {
      const normalizedName = name.trim().toLowerCase();
      if (!normalizedName) return;
      if (target.some((item) => item.trim().toLowerCase() === normalizedName)) {
        return;
      }
      target.push(name.trim());
    };

    for (const loc of localities) {
      if (loc.uf) {
        const entry = ensureUf(loc.uf);
        if (loc.catalogType === 'CIPAVD') {
          pushUniqueLocality(entry.cipavdLocalities, loc.name);
        } else {
          pushUniqueLocality(entry.smifLocalities, loc.name);
        }
      }
    }

    for (const om of omsCatalog) {
      if (!om.uf) continue;
      const entry = ensureUf(om.uf);
      pushUniqueLocality(
        entry.oms,
        this.formatOmDisplayLabel(om.code, om.name),
      );
    }

    for (const entry of ufMap.values()) {
      for (const locName of entry.smifLocalities) {
        pushUniqueLocality(entry.localitiesCombined, locName);
      }
      for (const locName of entry.cipavdLocalities) {
        pushUniqueLocality(entry.localitiesCombined, locName);
      }
      entry.localities = [...entry.localitiesCombined];
    }

    const surveyById = new Map(
      (surveyRows as any[]).map((row: any) => [
        String(row?.id ?? ''),
        row?.sufferedViolence === true,
      ]),
    );
    for (const link of surveyLinks as any[]) {
      const uf = String(link?.uf ?? link?.om?.uf ?? '')
        .trim()
        .toUpperCase();
      if (!uf) continue;
      const entry = ensureUf(uf);
      entry.schoolSurveyTotal += 1;
      if (surveyById.get(String(link?.sourceRecordId ?? '')) === true) {
        entry.schoolSurveyYes += 1;
      }
    }

    const domesticById = new Map(
      (domesticRows as any[]).map((row: any) => [
        String(row?.id ?? ''),
        row?.sufferedLast12Months === true,
      ]),
    );
    for (const link of domesticLinks as any[]) {
      const uf = String(link?.uf ?? link?.om?.uf ?? '')
        .trim()
        .toUpperCase();
      if (!uf) continue;
      const entry = ensureUf(uf);
      entry.domesticSurveyTotal += 1;
      if (domesticById.get(String(link?.sourceRecordId ?? '')) === true) {
        entry.domesticLast12MonthsYes += 1;
      }
    }

    const openStatuses = new Set([
      'RECEIVED',
      'PROTECTION_MEASURES',
      'PRELIMINARY_ANALYSIS',
      'PROCEDURE_DEFINED',
      'INVESTIGATION',
    ]);

    for (const c of complaints) {
      const uf = c.omId ? omUfMap.get(c.omId) : null;
      if (uf) {
        const entry = ensureUf(uf);
        const scope = String(c.workflowScope ?? 'CPCA')
          .trim()
          .toUpperCase();
        const isOpen = openStatuses.has(String(c.status ?? '').trim());
        entry.complaints++;
        if (scope === 'SMIF') {
          entry.smifComplaints++;
          if (isOpen) entry.smifOpenComplaints++;
        } else {
          entry.cpcaComplaints++;
          if (isOpen) entry.cpcaOpenComplaints++;
        }
        if (isOpen) entry.openComplaints++;
        entry.complaintDetails.push({
          caseNumber: c.caseNumber,
          type: c.complaintType,
          status: c.status,
          date: c.reportedAt?.toISOString?.() ?? '',
          locality: this.formatOmDisplayLabel(c.om?.code, c.om?.name),
          scope: c.workflowScope ?? '',
        });
      }
    }
    for (const a of activities) {
      const uf = a.localityId ? locUfMap.get(a.localityId) : null;
      if (uf) {
        const entry = ensureUf(uf);
        entry.activities++;
        entry.activityDetails.push({
          title: a.title,
          scope: a.scope,
          status: a.status,
          date: a.eventDate?.toISOString?.() ?? '',
          locality: (a as any).locality?.name ?? '',
        });
      }
    }
    for (const m of missions) {
      const uf = locUfMap.get(m.localityId);
      if (uf) {
        const entry = ensureUf(uf);
        entry.missions++;
        entry.missionDetails.push({
          title: m.title,
          scope: m.scope,
          startDate: m.startDate?.toISOString?.() ?? '',
          endDate: m.endDate?.toISOString?.() ?? '',
          locality: m.locality?.name ?? '',
        });
      }
    }

    for (const entry of ufMap.values()) {
      entry.researchSignals =
        entry.schoolSurveyYes + entry.domesticLast12MonthsYes;
      entry.hasResearch =
        entry.schoolSurveyTotal + entry.domesticSurveyTotal > 0;
      const schoolEvidence = this.buildEvidenceSummary(
        entry.schoolSurveyTotal,
        entry.schoolSurveyYes,
      );
      const domesticEvidence = this.buildEvidenceSummary(
        entry.domesticSurveyTotal,
        entry.domesticLast12MonthsYes,
      );
      const complaintPressure =
        entry.cpcaOpenComplaints * 5 +
        entry.smifOpenComplaints * 3 +
        Math.max(entry.complaints - entry.openComplaints, 0) * 0.75;
      const researchPressure =
        schoolEvidence.adjustedRate * 0.35 +
        domesticEvidence.adjustedRate * 0.45 +
        entry.researchSignals * 0.8;
      entry.pressureScore = Number(
        (complaintPressure + researchPressure).toFixed(1),
      );
      entry.responseScore = Number(
        (entry.activities + entry.missions * 0.25).toFixed(1),
      );
    }

    const states = Array.from(ufMap.values()).sort((a, b) => {
      if (b.pressureScore !== a.pressureScore) {
        return b.pressureScore - a.pressureScore;
      }
      return b.complaints - a.complaints;
    });

    return {
      generatedAt: new Date().toISOString(),
      states,
      summary: {
        statesWithCpcaComplaints: states.filter(
          (item) => item.cpcaComplaints > 0,
        ).length,
        statesWithFormalComplaints: states.filter((item) => item.complaints > 0)
          .length,
        statesWithResearch: states.filter((item) => item.hasResearch).length,
        statesWithComplaintsWithoutResearch: states.filter(
          (item) => item.complaints > 0 && !item.hasResearch,
        ).length,
        statesWithResponseOnly: states.filter(
          (item) =>
            item.complaints === 0 &&
            item.researchSignals === 0 &&
            (item.activities > 0 || item.missions > 0),
        ).length,
      },
      totalLocalitiesWithUf: localities.filter((l) => l.uf).length,
      totalLocalitiesWithCpca: oms.filter((om) => om.hasCpca).length,
      totalOmsCoveredByCpca: coveredOmsCatalog.length,
      totalLocalities: localities.length,
      localitiesCatalog,
      omsCatalog,
      cpcaCoveredOmsCatalog: coveredOmsCatalog,
    };
  }

  async aggressorProfile(filters?: StrategicSourceFilter) {
    const sourceSet = this.resolveSourceSet(filters?.sources);
    if (!this.hasComplaintSources(sourceSet)) {
      return {
        totalCases: 0,
        message: 'Nenhum caso registrado para as fontes selecionadas.',
      };
    }

    const complaintModel = (this.prisma as any).cpcComplaintCase;
    const complaintScopes = this.buildComplaintScopeFilter(sourceSet);
    const where =
      complaintScopes.length > 0
        ? {
            workflowScope: {
              in: complaintScopes,
            },
          }
        : {};

    const cases = await complaintModel.findMany({
      where,
      select: {
        id: true,
        caseNumber: true,
        complaintType: true,
        aggressorRank: true,
        aggressorGender: true,
        aggressorAgeRange: true,
        victimRank: true,
        victimGender: true,
        victimAgeRange: true,
        detailedViolenceType: true,
        harassmentContext: true,
        occurrenceLocation: true,
        hierarchicalFunctionalRelation: true,
        incidentFrequency: true,
        occurrenceForm: true,
        occurrenceForms: true,
        workflowScope: true,
        status: true,
        reportedAt: true,
        omId: true,
        om: { select: { code: true, name: true } },
        localityId: true,
        locality: { select: { code: true, name: true } },
      },
    });

    const casesWithResolvedLocality = cases.map((row: any) => ({
      ...row,
      resolvedOccurrenceForms:
        Array.isArray(row?.occurrenceForms) && row.occurrenceForms.length > 0
          ? row.occurrenceForms
          : row?.occurrenceForm
            ? [row.occurrenceForm]
            : [],
      resolvedLocalityId:
        String(row?.omId ?? row?.localityId ?? '').trim() || 'NAO_INFORMADO',
      resolvedLocality: row?.om ?? row?.locality ?? null,
    }));

    const totalCases = casesWithResolvedLocality.length;
    if (totalCases === 0) {
      return { totalCases: 0, message: 'Nenhum caso registrado.' };
    }

    const moralCases = casesWithResolvedLocality.filter(
      (c: any) => c.complaintType === 'MORAL',
    );
    const sexualCases = casesWithResolvedLocality.filter(
      (c: any) => c.complaintType === 'SEXUAL',
    );

    const hierarchicalCount = casesWithResolvedLocality.filter(
      (c: any) =>
        c.hierarchicalFunctionalRelation &&
        /superior|chefia|comando|hierarq/i.test(
          c.hierarchicalFunctionalRelation,
        ),
    ).length;

    const byScope = countByField(casesWithResolvedLocality, 'workflowScope');

    const toCaseDetail = (row: any): StrategicKpiDetailItem => {
      const id = String(row?.id ?? '').trim();
      const caseNumber = String(row?.caseNumber ?? '').trim();
      const scope = String(row?.workflowScope ?? 'CPCA')
        .trim()
        .toUpperCase();
      const localityLabel = this.formatOmDisplayLabel(
        row?.resolvedLocality?.code,
        row?.resolvedLocality?.name,
      );
      return {
        id: id || `aggressor-${caseNumber || 'case'}`,
        title: caseNumber ? `Denúncia ${caseNumber}` : 'Denúncia',
        subtitle: [
          scope,
          String(row?.complaintType ?? '').trim()
            ? `Tipo: ${
                String(row?.complaintType ?? '')
                  .trim()
                  .toUpperCase() === 'SEXUAL'
                  ? 'Assédio Sexual'
                  : 'Assédio Moral'
              }`
            : '',
          localityLabel,
        ]
          .filter(Boolean)
          .join(' • '),
        date: row?.reportedAt?.toISOString?.() ?? undefined,
        badge: String(row?.status ?? '').trim() || undefined,
        link:
          scope === 'SMIF'
            ? `/smif-complaints?q=${encodeURIComponent(caseNumber)}`
            : `/cpca-cases?q=${encodeURIComponent(caseNumber)}`,
      };
    };
    const totalDetails = casesWithResolvedLocality.map((row: any) =>
      toCaseDetail(row),
    );
    const moralDetails = moralCases.map((row: any) => toCaseDetail(row));
    const sexualDetails = sexualCases.map((row: any) => toCaseDetail(row));
    const hierarchicalDetails = casesWithResolvedLocality
      .filter(
        (c: any) =>
          c.hierarchicalFunctionalRelation &&
          /superior|chefia|comando|hierarq/i.test(
            c.hierarchicalFunctionalRelation,
          ),
      )
      .map((row: any) => toCaseDetail(row));

    const crossTab: {
      complaintType: string;
      aggressorGender: string;
      victimGender: string;
      count: number;
    }[] = [];
    const crossMap = new Map<string, number>();
    for (const c of casesWithResolvedLocality) {
      const key = `${c.complaintType ?? '?'}|${c.aggressorGender ?? '?'}|${c.victimGender ?? '?'}`;
      crossMap.set(key, (crossMap.get(key) ?? 0) + 1);
    }
    for (const [key, count] of crossMap) {
      const [complaintType, aggressorGender, victimGender] = key.split('|');
      crossTab.push({ complaintType, aggressorGender, victimGender, count });
    }
    crossTab.sort((a, b) => b.count - a.count);

    return {
      generatedAt: new Date().toISOString(),
      totalCases,
      byComplaintType: {
        moral: {
          count: moralCases.length,
          percent: pct(moralCases.length, totalCases),
        },
        sexual: {
          count: sexualCases.length,
          percent: pct(sexualCases.length, totalCases),
        },
      },
      hierarchicalRelation: {
        count: hierarchicalCount,
        percent: pct(hierarchicalCount, totalCases),
        description: 'Casos onde o agressor é superior hierárquico da vítima',
      },
      aggressorProfile: {
        byRank: countByField(casesWithResolvedLocality, 'aggressorRank'),
        byGender: countByField(casesWithResolvedLocality, 'aggressorGender'),
        byAgeRange: countByField(
          casesWithResolvedLocality,
          'aggressorAgeRange',
        ),
      },
      victimProfile: {
        byRank: countByField(casesWithResolvedLocality, 'victimRank'),
        byGender: countByField(casesWithResolvedLocality, 'victimGender'),
        byAgeRange: countByField(casesWithResolvedLocality, 'victimAgeRange'),
      },
      context: {
        byViolenceType: countByField(
          casesWithResolvedLocality,
          'detailedViolenceType',
        ),
        byHarassmentContext: countByField(
          casesWithResolvedLocality,
          'harassmentContext',
        ),
        byLocation: countByField(
          casesWithResolvedLocality,
          'occurrenceLocation',
        ),
        byFrequency: countByField(
          casesWithResolvedLocality,
          'incidentFrequency',
        ),
        byForm: countByField(
          casesWithResolvedLocality,
          'resolvedOccurrenceForms',
        ),
      },
      crossTabulation: crossTab,
      byScope,
      detailItems: {
        total: totalDetails,
        moral: moralDetails,
        sexual: sexualDetails,
        hierarchical: hierarchicalDetails,
      },
      byLocality: Array.from<{
        label: string;
        count: number;
        localityCode: string;
        localityName: string;
        detailItems: StrategicKpiDetailItem[];
      }>(
        casesWithResolvedLocality
          .reduce(
            (
              acc: Map<
                string,
                {
                  label: string;
                  count: number;
                  localityCode: string;
                  localityName: string;
                  detailItems: StrategicKpiDetailItem[];
                }
              >,
              row: any,
            ) => {
              const key =
                String(row?.resolvedLocalityId ?? '').trim() || 'NAO_INFORMADO';
              const displayLabel =
                this.formatOmDisplayLabel(
                  row?.resolvedLocality?.code,
                  row?.resolvedLocality?.name,
                ) || (key === 'NAO_INFORMADO' ? 'Não informado' : key);
              const current = acc.get(key) ?? {
                label: displayLabel,
                count: 0,
                localityCode: String(row?.resolvedLocality?.code ?? '').trim(),
                localityName: displayLabel,
                detailItems: [],
              };
              current.count += 1;
              current.detailItems.push(toCaseDetail(row));
              if (!current.localityCode) {
                current.localityCode = String(
                  row?.resolvedLocality?.code ?? '',
                ).trim();
              }
              if (
                !current.localityName ||
                current.localityName === 'Não informado'
              ) {
                current.localityName =
                  this.formatOmDisplayLabel(
                    row?.resolvedLocality?.code,
                    row?.resolvedLocality?.name,
                  ) || current.localityName;
              }
              if (!current.label || current.label === key) {
                current.label = current.localityName || displayLabel;
              }
              acc.set(key, current);
              return acc;
            },
            new Map<
              string,
              {
                label: string;
                count: number;
                localityCode: string;
                localityName: string;
              }
            >(),
          )
          .values(),
      )
        .map((item) => ({
          ...item,
          percent: pct(item.count, totalCases),
        }))
        .sort((a, b) => b.count - a.count),
    };
  }

  async textAnalysis(filters?: StrategicSourceFilter) {
    const sourceSet = this.resolveSourceSet(filters?.sources);
    const textSources = this.hasTextSourceSet(sourceSet);
    const includeRecruitSuggestions = textSources.recruits;
    const includeActivityReports = textSources.activityReports;
    const includeBestPractice = textSources.bestPracticeCycle;
    const includeCpcaMeeting = textSources.cpcaMeeting;
    const includeGsdEvaluation = textSources.gsdEvaluation;
    const includeComplaints =
      this.hasSource(sourceSet, AI_KNOWLEDGE_SOURCE_IDS.COMPLAINTS_CPCA) ||
      this.hasSource(sourceSet, AI_KNOWLEDGE_SOURCE_IDS.COMPLAINTS_SMIF);

    if (
      !includeRecruitSuggestions &&
      !includeActivityReports &&
      !includeBestPractice &&
      !includeCpcaMeeting &&
      !includeGsdEvaluation &&
      !includeComplaints
    ) {
      return {
        generatedAt: new Date().toISOString(),
        sources: {},
        consolidated: {
          totalTexts: 0,
          topWords: [],
          rawTexts: [],
        },
      };
    }

    const [
      recruitsResponses,
      activityReports,
      bestPracticeCycleResponses,
      cpcaMeetingResponses,
      gsdEvaluationResponses,
      cpcaComments,
    ] = await Promise.all([
      includeRecruitSuggestions
        ? (this.prisma as any).biRecruitsResponse
            .findMany({
              select: { suggestionComment: true },
            })
            .catch(() => [])
        : Promise.resolve([] as any[]),
      includeActivityReports
        ? (this.prisma as any).activityReport
            .findMany({
              select: {
                mainPointsObserved: true,
                attentionPoints: true,
                conclusion: true,
              },
            })
            .catch(() => [])
        : Promise.resolve([] as any[]),
      includeBestPractice
        ? (this.prisma as any).biBestPracticeCycleResponse
            .findMany({
              select: { interactionDifferenceComment: true },
            })
            .catch(() => [])
        : Promise.resolve([] as any[]),
      includeCpcaMeeting
        ? (this.prisma as any).biCpcaMeetingResponse
            .findMany({
              select: { answersJson: true },
            })
            .catch(() => [])
        : Promise.resolve([] as any[]),
      includeGsdEvaluation
        ? (this.prisma as any).biGsdEvaluationResponse
            .findMany({
              select: { answersJson: true },
            })
            .catch(() => [])
        : Promise.resolve([] as any[]),
      includeComplaints
        ? (this.prisma as any).cpcComplaintComment
            .findMany({
              select: { text: true },
            })
            .catch(() => [])
        : Promise.resolve([] as any[]),
    ]);

    const extractFreeTexts = (answers: unknown[]) =>
      answers
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return '';
          const objectValue = entry as Record<string, unknown>;
          for (const value of Object.values(objectValue)) {
            if (typeof value === 'string' && value.trim()) {
              return value;
            }
          }
          return '';
        })
        .filter(Boolean)
        .map((value) => String(value));

    const cpcaMeetingTexts = extractFreeTexts(cpcaMeetingResponses);
    const gsdEvaluationTexts = extractFreeTexts(gsdEvaluationResponses);

    const filterFreeText = (texts: string[]) => {
      const freq = new Map<string, number>();
      for (const t of texts) freq.set(t, (freq.get(t) ?? 0) + 1);
      return texts.filter((t) => freq.get(t)! <= 3 && t.trim().length > 5);
    };

    const suggestionTexts = filterFreeText(
      recruitsResponses.map((r: any) => r.suggestionComment).filter(Boolean),
    );
    const reportObservations = activityReports
      .map((r: any) => r.mainPointsObserved)
      .filter(Boolean);
    const reportAttention = activityReports
      .map((r: any) => r.attentionPoints)
      .filter(Boolean);
    const reportConclusions = activityReports
      .map((r: any) => r.conclusion)
      .filter(Boolean);
    const bestPracticeComments = bestPracticeCycleResponses
      .map((r: any) => r.interactionDifferenceComment)
      .filter(Boolean);
    const cpcaCommentTexts = cpcaComments
      .map((r: any) => r.text)
      .filter(Boolean);
    const allCpcaMeeting = includeCpcaMeeting ? cpcaMeetingTexts : [];
    const allGsdEvaluation = includeGsdEvaluation ? gsdEvaluationTexts : [];

    const allTexts = [
      ...suggestionTexts,
      ...reportObservations,
      ...reportAttention,
      ...reportConclusions,
      ...bestPracticeComments,
      ...cpcaCommentTexts,
      ...allCpcaMeeting,
      ...allGsdEvaluation,
    ];

    const buildSource = (texts: string[]) => ({
      count: texts.length,
      topWords: tokenizeAndCount(texts).slice(0, 50),
      rawTexts: texts.slice(0, 500),
    });

    return {
      generatedAt: new Date().toISOString(),
      sources: {
        recruitsSuggestions: buildSource(suggestionTexts),
        reportObservations: buildSource(reportObservations),
        reportAttentionPoints: buildSource(reportAttention),
        reportConclusions: buildSource(reportConclusions),
        bestPracticeComments: buildSource(bestPracticeComments),
        cpcaComments: buildSource(cpcaCommentTexts),
        cpcaMeeting: buildSource(allCpcaMeeting),
        gsdEvaluation: buildSource(allGsdEvaluation),
      },
      consolidated: {
        totalTexts: allTexts.length,
        topWords: tokenizeAndCount(allTexts).slice(0, 80),
        rawTexts: allTexts.slice(0, 1000),
      },
    };
  }

  async aiSourceReferences(
    type: AiAnalysisType,
    filters?: StrategicSourceFilter,
  ): Promise<AiSourceReference[]> {
    const refs: AiSourceReference[] = [];
    const seen = new Set<string>();
    const sourceSet = this.resolveSourceSet(filters?.sources);

    const shouldIncludeSurveys = this.hasSurveySources(sourceSet);
    const shouldIncludeDomestic = this.hasDomesticViolenceSources(sourceSet);
    const shouldIncludeRecruits = this.hasRecruitSources(sourceSet);
    const shouldIncludeBestPracticeCycle = this.hasSource(
      sourceSet,
      AI_KNOWLEDGE_SOURCE_IDS.SURVEY_BEST_PRACTICE_CYCLE,
    );
    const shouldIncludeCpcaMeeting = this.hasSource(
      sourceSet,
      AI_KNOWLEDGE_SOURCE_IDS.SURVEY_CPCA_MEETING,
    );
    const shouldIncludeGsdEvaluation = this.hasSource(
      sourceSet,
      AI_KNOWLEDGE_SOURCE_IDS.SURVEY_GSD_EVALUATION,
    );
    const shouldIncludeComplaintsCpca = this.hasSource(
      sourceSet,
      AI_KNOWLEDGE_SOURCE_IDS.COMPLAINTS_CPCA,
    );
    const shouldIncludeComplaintsSmif = this.hasSource(
      sourceSet,
      AI_KNOWLEDGE_SOURCE_IDS.COMPLAINTS_SMIF,
    );
    const shouldIncludeComplaints =
      shouldIncludeComplaintsCpca || shouldIncludeComplaintsSmif;
    const shouldIncludeActivityReports = this.hasSource(
      sourceSet,
      AI_KNOWLEDGE_SOURCE_IDS.ACTIVITY_REPORTS,
    );
    const shouldIncludeMissions = this.hasSource(
      sourceSet,
      AI_KNOWLEDGE_SOURCE_IDS.MISSIONS,
    );
    const shouldIncludeTasks = this.hasSource(
      sourceSet,
      AI_KNOWLEDGE_SOURCE_IDS.TASKS,
    );
    const shouldIncludeActivities = this.hasActivitySource(sourceSet);

    const pushRef = (
      id: string,
      label: string,
      href: string,
      description?: string,
    ) => {
      const safeHref = String(href || '').trim();
      if (!safeHref || seen.has(safeHref)) return;
      seen.add(safeHref);
      refs.push({
        id,
        label: String(label || '').trim() || 'Referência',
        href: safeHref,
        description: description?.trim() || undefined,
      });
    };

    const fmtDate = (value: unknown) => {
      if (!value) return '';
      const dt = new Date(String(value));
      if (Number.isNaN(dt.getTime())) return '';
      return dt.toLocaleDateString('pt-BR');
    };

    const includePanels =
      type === 'executive' ||
      type === 'situational' ||
      type === 'aggressor' ||
      type === 'text' ||
      type === 'chatbot' ||
      type === 'cpca_agent';

    if (includePanels) {
      if (shouldIncludeSurveys) {
        pushRef(
          'bi-survey-dashboard',
          'Pesquisa de escolas de formação',
          '/dashboard/bi',
        );
      }

      if (shouldIncludeDomestic) {
        pushRef(
          'bi-domestic-dashboard',
          'Pesquisa de violência doméstica',
          '/dashboard/bi-violencia-domestica',
        );
      }

      if (shouldIncludeRecruits) {
        pushRef(
          'bi-recruits-dashboard',
          'Pesquisa de recrutas',
          '/dashboard/bi-recrutas',
        );
      }

      if (shouldIncludeBestPracticeCycle) {
        pushRef(
          'bi-best-practice-cycle-dashboard',
          'Pesquisa de ciclo de boas práticas',
          '/dashboard/bi-ciclo-boas-praticas',
        );
      }

      if (shouldIncludeCpcaMeeting) {
        pushRef(
          'bi-cpca-meeting-dashboard',
          'Pesquisa de encontro CPCA',
          '/dashboard/bi-encontro-cpca',
        );
      }

      if (shouldIncludeGsdEvaluation) {
        pushRef(
          'bi-gsd-evaluation-dashboard',
          'Pesquisa de avaliação GSD',
          '/dashboard/bi-avaliacao-gsd',
        );
      }

      if (this.hasSource(sourceSet, AI_KNOWLEDGE_SOURCE_IDS.BEST_PRACTICES)) {
        pushRef('best-practices', 'Boas práticas', '/best-practices');
      }

      pushRef(
        'strategic-dashboard',
        'Painel estratégico consolidado',
        '/dashboard/estrategico',
      );
    }

    if (
      (type === 'executive' || type === 'situational' || type === 'text') &&
      shouldIncludeRecruits
    ) {
      const latestRecruitBatch = await (
        this.prisma as any
      ).biRecruitsImportBatch
        .findFirst({
          orderBy: { importedAt: 'desc' },
          select: {
            id: true,
            fileName: true,
            importedAt: true,
            insertedRows: true,
          },
        })
        .catch(() => null);
      if (latestRecruitBatch) {
        pushRef(
          `recruits-batch-${latestRecruitBatch.id}`,
          `Lote de recrutas: ${latestRecruitBatch.fileName || latestRecruitBatch.id}`,
          '/dashboard/bi-recrutas',
          `Importado em ${fmtDate(latestRecruitBatch.importedAt)} (${Number(latestRecruitBatch.insertedRows ?? 0)} linha(s))`,
        );
      }
    }

    if (
      (type === 'executive' || type === 'situational' || type === 'text') &&
      shouldIncludeActivityReports
    ) {
      const recentReports = await (this.prisma as any).activityReport
        .findMany({
          take: 3,
          orderBy: [{ signedAt: 'desc' }, { updatedAt: 'desc' }],
          select: {
            id: true,
            activityId: true,
            signedAt: true,
            updatedAt: true,
            activity: {
              select: {
                id: true,
                title: true,
                scope: true,
              },
            },
          },
        })
        .catch(() => []);

      for (const report of recentReports as any[]) {
        const activityId = String(
          report?.activityId ?? report?.activity?.id ?? '',
        ).trim();
        if (!activityId) continue;
        const scope = String(report?.activity?.scope ?? 'SMIF').toUpperCase();
        const href =
          scope === 'CIPAVD'
            ? `/activities-cipavd?activityId=${encodeURIComponent(activityId)}&tab=report`
            : `/activities?activityId=${encodeURIComponent(activityId)}&tab=report`;
        const title =
          String(report?.activity?.title ?? '').trim() ||
          `Atividade ${activityId}`;
        const refDate = fmtDate(report?.signedAt ?? report?.updatedAt);
        pushRef(
          `activity-report-${report?.id ?? activityId}`,
          `Relatório de atividade: ${title}`,
          href,
          refDate ? `Última atualização em ${refDate}` : undefined,
        );
      }
    }

    if (
      (type === 'executive' || type === 'situational' || type === 'geo') &&
      shouldIncludeMissions
    ) {
      const recentMissions = await (this.prisma as any).mission
        .findMany({
          take: 3,
          orderBy: { startDate: 'desc' },
          select: {
            id: true,
            title: true,
            scope: true,
            startDate: true,
            endDate: true,
          },
        })
        .catch(() => []);

      for (const mission of recentMissions as any[]) {
        const missionId = String(mission?.id ?? '').trim();
        if (!missionId) continue;
        const scope =
          String(mission?.scope ?? 'SMIF').toUpperCase() === 'CIPAVD'
            ? 'CIPAVD'
            : 'SMIF';
        const href = `/missions?missionId=${encodeURIComponent(missionId)}&scope=${scope}`;
        const title =
          String(mission?.title ?? '').trim() || `Missão ${missionId}`;
        const periodStart = fmtDate(mission?.startDate);
        const periodEnd = fmtDate(mission?.endDate);
        const period =
          periodStart && periodEnd
            ? `${periodStart} a ${periodEnd}`
            : periodStart || periodEnd || '';
        pushRef(
          `mission-${missionId}`,
          `Missão: ${title}`,
          href,
          period ? `Período ${period}` : undefined,
        );
      }
    }

    if (
      type === 'executive' ||
      type === 'aggressor' ||
      type === 'situational'
    ) {
      if (shouldIncludeComplaints) {
        const complaintScopes = this.buildComplaintScopeFilter(sourceSet);
        const where =
          complaintScopes.length === 0
            ? {}
            : { workflowScope: { in: complaintScopes } };
        const recentCases = await (this.prisma as any).cpcComplaintCase
          .findMany({
            where,
            take: 3,
            orderBy: { reportedAt: 'desc' },
            select: {
              id: true,
              caseNumber: true,
              workflowScope: true,
              status: true,
              reportedAt: true,
            },
          })
          .catch(() => []);

        for (const item of recentCases as any[]) {
          const caseNumber = String(item?.caseNumber ?? '').trim();
          if (!caseNumber) continue;
          const workflow = String(item?.workflowScope ?? 'CPCA').toUpperCase();
          const href =
            workflow === 'SMIF'
              ? `/smif-complaints?q=${encodeURIComponent(caseNumber)}`
              : `/cpca-cases?q=${encodeURIComponent(caseNumber)}`;
          const status = String(item?.status ?? '').trim();
          const date = fmtDate(item?.reportedAt);
          pushRef(
            `complaint-${item?.id ?? caseNumber}`,
            `Denúncia ${caseNumber}`,
            href,
            [workflow, status, date].filter(Boolean).join(' • '),
          );
        }
      }
    }

    if (shouldIncludeTasks) {
      const totalTasks = await this.prisma.taskInstance.count();
      if (totalTasks > 0) {
        pushRef('tasks-list', 'Tarefas', '/tasks', `Total: ${totalTasks}`);
      }
    }

    if (shouldIncludeActivities) {
      const scopeFilter = this.buildActivityScopeFilter(sourceSet);
      const where = scopeFilter ? { scope: scopeFilter } : {};
      const latestActivities = await this.prisma.activity.findMany({
        where,
        orderBy: [{ eventDate: 'desc' }, { updatedAt: 'desc' }],
        take: 3,
        select: {
          id: true,
          title: true,
          scope: true,
          eventDate: true,
          locality: { select: { name: true } },
        },
      });
      for (const activity of latestActivities) {
        const activityId = String(activity?.id ?? '').trim();
        if (!activityId) continue;
        const route =
          String(activity?.scope ?? 'SMIF').toUpperCase() === 'CIPAVD'
            ? '/activities-cipavd'
            : '/activities';
        const href = `${route}?activityId=${encodeURIComponent(activityId)}`;
        const title =
          String(activity?.title ?? '').trim() || `Atividade ${activityId}`;
        const date = fmtDate(activity?.eventDate);
        pushRef(
          `activity-${activityId}`,
          `Atividade de campo: ${title}`,
          href,
          date ? `Data: ${date}` : undefined,
        );
      }
    }

    return refs.slice(0, 12);
  }

  /**
   * Narrativa executiva gerada via LiteLLM (API compatível com OpenAI),
   * usando API_LITELLM + API_LITELLM_BASE_URL.
   */
  async strategicAiNarrative(): Promise<{
    generatedAt: string;
    narrative: string;
    model: string;
  }> {
    if (!this.litellm.isConfigured()) {
      throw new ServiceUnavailableException(
        `LiteLLM não configurado. No servidor, edite o .env do backend (ex.: /opt/gestao-projetos/backend/.env) e defina ` +
          `chave (${LITELLM_API_KEY_ENV_KEYS.join(' ou ')}) e URL (${LITELLM_BASE_URL_ENV_KEYS.join(' ou ')}). ` +
          `Depois: systemctl restart cipavd-backend.service`,
      );
    }

    const [dashboard, profile, textSummary, geo] = await Promise.all([
      this.situationalDashboard(),
      this.aggressorProfile(),
      this.textAnalysis(),
      this.geoMap(),
    ]);

    const profileAny = profile as Record<string, unknown>;
    const compactGeo = {
      statesSample: (geo.states ?? []).slice(0, 12).map((s: any) => ({
        uf: s.uf,
        complaints: s.complaints,
        activities: s.activities,
        missions: s.missions,
      })),
      totalLocalitiesWithUf: geo.totalLocalitiesWithUf,
    };

    const compactText = {
      totalTexts: textSummary.consolidated.totalTexts,
      topWords: textSummary.consolidated.topWords.slice(0, 30),
    };

    const compactDashboard = {
      ...dashboard,
      surveys: {
        totalResponses: dashboard.surveys?.totalResponses ?? 0,
        yesCount: dashboard.surveys?.yesCount ?? 0,
        noCount: dashboard.surveys?.noCount ?? 0,
        violenceRatePercent: dashboard.surveys?.violenceRatePercent ?? 0,
      },
      domesticViolence: {
        totalResponses: dashboard.domesticViolence?.totalResponses ?? 0,
        lifetimeYes: dashboard.domesticViolence?.lifetimeYes ?? 0,
        lifetimeRatePercent:
          dashboard.domesticViolence?.lifetimeRatePercent ?? 0,
        last12MonthsYes: dashboard.domesticViolence?.last12MonthsYes ?? 0,
        last12MonthsRatePercent:
          dashboard.domesticViolence?.last12MonthsRatePercent ?? 0,
        soughtHelp: dashboard.domesticViolence?.soughtHelp ?? 0,
        soughtHelpPercent: dashboard.domesticViolence?.soughtHelpPercent ?? 0,
      },
      recruits: {
        totalResponses: dashboard.recruits?.totalResponses ?? 0,
        safeCount: dashboard.recruits?.safeCount ?? 0,
        safeToReportPercent: dashboard.recruits?.safeToReportPercent ?? 0,
        knowProcess: dashboard.recruits?.knowProcess ?? 0,
        knowReportProcessPercent:
          dashboard.recruits?.knowReportProcessPercent ?? 0,
      },
      complaints: {
        totalCases: dashboard.complaints?.totalCases ?? 0,
        openCases: dashboard.complaints?.openCases ?? 0,
        concludedCases: dashboard.complaints?.concludedCases ?? 0,
        byCpca: dashboard.complaints?.byCpca ?? 0,
        bySmif: dashboard.complaints?.bySmif ?? 0,
        moral: dashboard.complaints?.moral ?? 0,
        sexual: dashboard.complaints?.sexual ?? 0,
      },
      activities: {
        totalActivities: dashboard.activities?.totalActivities ?? 0,
        done: dashboard.activities?.done ?? 0,
        smif: dashboard.activities?.smif ?? 0,
        cipavd: dashboard.activities?.cipavd ?? 0,
        withReport: dashboard.activities?.withReport ?? 0,
        signed: dashboard.activities?.signed ?? 0,
      },
      missions: {
        totalMissions: dashboard.missions?.totalMissions ?? 0,
        smif: dashboard.missions?.smif ?? 0,
        cipavd: dashboard.missions?.cipavd ?? 0,
        localitiesCovered: dashboard.missions?.localitiesCovered ?? 0,
      },
    };

    const payload = {
      situationalDashboard: compactDashboard,
      aggressorProfile: profileAny,
      textAnalysisSummary: compactText,
      geoSummary: compactGeo,
    };

    let payloadJson = JSON.stringify(payload);
    const maxChars = 28_000;
    if (payloadJson.length > maxChars) {
      payloadJson = payloadJson.slice(0, maxChars) + '\n…(dados truncados)';
    }

    const system =
      'Você é analista institucional da FAB (CIPAVD/SMIF). ' +
      'Responda em português do Brasil, tom técnico e objetivo, sem inventar números que não constem no JSON. ' +
      'Estruture em 3 a 5 parágrafos curtos: síntese situacional, riscos/padrões nas denúncias (se houver casos), ' +
      'destaques da análise textual e distribuição geográfica quando relevante.';

    try {
      const { content, model } = await this.litellm.chatCompletion({
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content:
              'Com base exclusivamente nos dados JSON abaixo, redija um resumo executivo para comando.\n\n' +
              payloadJson,
          },
        ],
        max_tokens: 2500,
      });

      return {
        generatedAt: new Date().toISOString(),
        narrative: await this.enforcePortugueseNarrative(content),
        model,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new ServiceUnavailableException(
        `Falha ao gerar narrativa via LiteLLM: ${msg}`,
      );
    }
  }

  async executiveReportPdf(): Promise<Buffer> {
    const [dashboard, profileRaw, textData, geoData] = await Promise.all([
      this.situationalDashboard(),
      this.aggressorProfile(),
      this.textAnalysis(),
      this.geoMap(),
    ]);
    const profile = profileRaw as any;
    const statesWithRecordsCount = (geoData.states ?? []).filter(
      (s: any) => s.complaints + s.activities + s.missions > 0,
    ).length;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
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
      const GRAY = '#666666';
      const DARK = '#222222';
      const BG_LIGHT = '#F0F4F8';
      const BG_CARD = '#FFFFFF';
      const PAGE_W = 515;
      const LEFT = 40;
      const RIGHT = LEFT + PAGE_W;

      const ensureSpace = (needed: number) => {
        if (doc.y + needed > 780) doc.addPage();
      };

      const drawHeaderBar = (y: number) => {
        doc.rect(0, y, 595, 70).fill(BLUE);
        doc.rect(0, y + 70, 595, 4).fill(ORANGE);
      };

      const sectionHeader = (num: string, title: string) => {
        ensureSpace(40);
        const y = doc.y;
        doc.rect(LEFT, y, PAGE_W, 26).fill(BLUE);
        doc
          .fontSize(12)
          .fillColor('#FFFFFF')
          .text(`${num}  ${title}`, LEFT + 10, y + 7, { width: PAGE_W - 20 });
        doc.y = y + 32;
      };

      const kpiBox = (
        x: number,
        y: number,
        w: number,
        h: number,
        value: string,
        label: string,
        color: string,
      ) => {
        doc.roundedRect(x, y, w, h, 4).fill(BG_LIGHT);
        doc.roundedRect(x, y, 4, h, 2).fill(color);
        doc
          .fontSize(18)
          .fillColor(color)
          .text(value, x + 12, y + 8, { width: w - 20, align: 'center' });
        doc
          .fontSize(7)
          .fillColor(GRAY)
          .text(label, x + 8, y + 30, { width: w - 16, align: 'center' });
        return y + h + 6;
      };

      const progressBar = (
        x: number,
        y: number,
        w: number,
        pct: number,
        color: string,
        label: string,
        valueText: string,
      ) => {
        doc
          .fontSize(8)
          .fillColor(DARK)
          .text(label, x, y, { width: w * 0.55 });
        const barX = x + w * 0.55;
        const barW = w * 0.35;
        const barH = 8;
        doc.roundedRect(barX, y + 1, barW, barH, 3).fill('#E0E0E0');
        const fillW = Math.max(2, (pct / 100) * barW);
        doc.roundedRect(barX, y + 1, fillW, barH, 3).fill(color);
        doc
          .fontSize(8)
          .fillColor(color)
          .text(valueText, barX + barW + 4, y, { width: 50 });
        return y + 16;
      };

      const rankingRow = (
        x: number,
        y: number,
        w: number,
        rank: number,
        label: string,
        count: number,
        pct: number,
        color: string,
        maxCount: number,
      ) => {
        doc.fontSize(8).fillColor(GRAY).text(`${rank}.`, x, y, { width: 14 });
        doc
          .fontSize(8)
          .fillColor(DARK)
          .text(label, x + 14, y, { width: w * 0.45 });
        const barX = x + w * 0.52;
        const barW = w * 0.35;
        const barH = 7;
        doc.roundedRect(barX, y + 1, barW, barH, 3).fill('#E8EAF0');
        const fillW = Math.max(2, maxCount > 0 ? (count / maxCount) * barW : 0);
        doc.roundedRect(barX, y + 1, fillW, barH, 3).fill(color);
        doc
          .fontSize(7)
          .fillColor(DARK)
          .text(`${count} (${pct}%)`, barX + barW + 4, y, { width: 55 });
        return y + 14;
      };

      // ======================== COVER PAGE ========================
      drawHeaderBar(0);
      doc
        .fontSize(24)
        .fillColor('#FFFFFF')
        .text('RELATÓRIO EXECUTIVO', LEFT + 10, 18, {
          width: PAGE_W - 20,
          align: 'center',
        });
      doc
        .fontSize(11)
        .fillColor('#B0C4DE')
        .text(
          'CIPAVD / SMIF — Prevenção e Combate ao Assédio e Violência Doméstica',
          LEFT,
          46,
          { width: PAGE_W, align: 'center' },
        );

      doc.y = 90;
      doc
        .fontSize(9)
        .fillColor(GRAY)
        .text(
          `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
          { align: 'right' },
        );
      doc.moveDown(0.8);

      // ======================== 1. INDICADORES-CHAVE ========================
      sectionHeader('01', 'INDICADORES-CHAVE DE DESEMPENHO');
      doc.moveDown(0.3);

      let ky = doc.y;
      const kw = (PAGE_W - 18) / 4;
      kpiBox(
        LEFT,
        ky,
        kw,
        44,
        String(dashboard.activities.totalActivities),
        'Atividades de Campo',
        BLUE,
      );
      kpiBox(
        LEFT + kw + 6,
        ky,
        kw,
        44,
        String(dashboard.missions.totalMissions),
        'Missões Realizadas',
        GREEN,
      );
      kpiBox(
        LEFT + (kw + 6) * 2,
        ky,
        kw,
        44,
        String(dashboard.complaints.totalCases),
        'Denúncias Registradas',
        RED,
      );
      kpiBox(
        LEFT + (kw + 6) * 3,
        ky,
        kw,
        44,
        String(dashboard.complaints.openCases),
        'Casos em Aberto',
        ORANGE,
      );
      doc.y = ky + 56;

      ky = doc.y;
      kpiBox(
        LEFT,
        ky,
        kw,
        44,
        String(dashboard.surveys.totalResponses),
        'Pesquisas (Escolas)',
        BLUE_LIGHT,
      );
      kpiBox(
        LEFT + kw + 6,
        ky,
        kw,
        44,
        String(dashboard.domesticViolence.totalResponses ?? 0),
        'Pesq. Violência Domést.',
        RED,
      );
      kpiBox(
        LEFT + (kw + 6) * 2,
        ky,
        kw,
        44,
        String(dashboard.recruits.totalResponses ?? 0),
        'Pesq. Recrutas',
        GREEN,
      );
      kpiBox(
        LEFT + (kw + 6) * 3,
        ky,
        kw,
        44,
        String(statesWithRecordsCount),
        'UFs com registros',
        GRAY,
      );
      doc.y = ky + 56;

      // ======================== 2. TAXAS E INDICADORES ========================
      sectionHeader('02', 'TAXAS E INDICADORES PERCENTUAIS');
      doc.moveDown(0.3);

      let py = doc.y;
      const pw = PAGE_W;
      py = progressBar(
        LEFT,
        py,
        pw,
        dashboard.surveys.violenceRatePercent,
        RED,
        'Taxa de violência relatada (Escolas)',
        `${dashboard.surveys.violenceRatePercent}%`,
      );
      py = progressBar(
        LEFT,
        py,
        pw,
        dashboard.domesticViolence.lifetimeRatePercent,
        RED,
        'Violência doméstica (na vida)',
        `${dashboard.domesticViolence.lifetimeRatePercent}%`,
      );
      py = progressBar(
        LEFT,
        py,
        pw,
        dashboard.domesticViolence.last12MonthsRatePercent,
        ORANGE,
        'Violência doméstica (últimos 12 meses)',
        `${dashboard.domesticViolence.last12MonthsRatePercent}%`,
      );
      py = progressBar(
        LEFT,
        py,
        pw,
        dashboard.recruits.safeToReportPercent,
        GREEN,
        'Recrutas — Segurança para denunciar',
        `${dashboard.recruits.safeToReportPercent}%`,
      );
      py = progressBar(
        LEFT,
        py,
        pw,
        dashboard.recruits.knowReportProcessPercent ?? 0,
        BLUE,
        'Recrutas — Conhece processo de denúncia',
        `${dashboard.recruits.knowReportProcessPercent ?? 0}%`,
      );
      if (dashboard.domesticViolence.soughtHelpPercent) {
        py = progressBar(
          LEFT,
          py,
          pw,
          dashboard.domesticViolence.soughtHelpPercent,
          GREEN,
          'Vítimas que buscaram ajuda',
          `${dashboard.domesticViolence.soughtHelpPercent}%`,
        );
      }
      doc.y = py + 4;

      // ======================== 3. ATIVIDADES E MISSÕES ========================
      ensureSpace(90);
      sectionHeader('03', 'DISTRIBUIÇÃO DE ATIVIDADES E MISSÕES');
      doc.moveDown(0.3);

      const halfW = (PAGE_W - 12) / 2;
      const actY = doc.y;

      doc.roundedRect(LEFT, actY, halfW, 70, 4).fill(BG_LIGHT);
      doc
        .fontSize(9)
        .fillColor(BLUE)
        .text('ATIVIDADES DE CAMPO', LEFT + 8, actY + 6, { width: halfW - 16 });
      doc
        .fontSize(8)
        .fillColor(DARK)
        .text(
          `Total: ${dashboard.activities.totalActivities}`,
          LEFT + 8,
          actY + 20,
        )
        .text(
          `SMIF: ${dashboard.activities.smif}  |  CIPAVD: ${dashboard.activities.cipavd}`,
          LEFT + 8,
          actY + 32,
        )
        .text(
          `Concluídas: ${dashboard.activities.done}  |  Relatórios: ${dashboard.activities.withReport}`,
          LEFT + 8,
          actY + 44,
        )
        .text(
          `Relatórios assinados: ${dashboard.activities.signed}`,
          LEFT + 8,
          actY + 56,
        );

      doc.roundedRect(LEFT + halfW + 12, actY, halfW, 70, 4).fill(BG_LIGHT);
      doc
        .fontSize(9)
        .fillColor(GREEN)
        .text('MISSÕES', LEFT + halfW + 20, actY + 6, { width: halfW - 16 });
      doc
        .fontSize(8)
        .fillColor(DARK)
        .text(
          `Total: ${dashboard.missions.totalMissions}`,
          LEFT + halfW + 20,
          actY + 20,
        )
        .text(
          `SMIF: ${dashboard.missions.smif}  |  CIPAVD: ${dashboard.missions.cipavd}`,
          LEFT + halfW + 20,
          actY + 32,
        )
        .text(
          `Localidades cobertas: ${dashboard.missions.localitiesCovered}`,
          LEFT + halfW + 20,
          actY + 44,
        );

      doc.y = actY + 82;

      // ======================== 4. DENÚNCIAS ========================
      ensureSpace(100);
      sectionHeader('04', 'PANORAMA DE DENÚNCIAS');
      doc.moveDown(0.3);

      const compY = doc.y;
      const thirdW = (PAGE_W - 12) / 3;

      doc.roundedRect(LEFT, compY, thirdW, 50, 4).fill(BG_LIGHT);
      doc.roundedRect(LEFT, compY, 4, 50, 2).fill(RED);
      doc
        .fontSize(20)
        .fillColor(RED)
        .text(String(dashboard.complaints.totalCases), LEFT + 12, compY + 6, {
          width: thirdW - 20,
          align: 'center',
        });
      doc
        .fontSize(7)
        .fillColor(GRAY)
        .text('Total de denúncias', LEFT + 8, compY + 32, {
          width: thirdW - 16,
          align: 'center',
        });

      doc.roundedRect(LEFT + thirdW + 6, compY, thirdW, 50, 4).fill(BG_LIGHT);
      doc.roundedRect(LEFT + thirdW + 6, compY, 4, 50, 2).fill(ORANGE);
      doc
        .fontSize(20)
        .fillColor(ORANGE)
        .text(
          String(dashboard.complaints.openCases),
          LEFT + thirdW + 18,
          compY + 6,
          { width: thirdW - 20, align: 'center' },
        );
      doc
        .fontSize(7)
        .fillColor(GRAY)
        .text('Casos em aberto', LEFT + thirdW + 12, compY + 32, {
          width: thirdW - 16,
          align: 'center',
        });

      doc
        .roundedRect(LEFT + (thirdW + 6) * 2, compY, thirdW, 50, 4)
        .fill(BG_LIGHT);
      doc.roundedRect(LEFT + (thirdW + 6) * 2, compY, 4, 50, 2).fill(GREEN);
      doc
        .fontSize(20)
        .fillColor(GREEN)
        .text(
          String(dashboard.complaints.concludedCases),
          LEFT + (thirdW + 6) * 2 + 12,
          compY + 6,
          { width: thirdW - 20, align: 'center' },
        );
      doc
        .fontSize(7)
        .fillColor(GRAY)
        .text('Concluídos', LEFT + (thirdW + 6) * 2 + 8, compY + 32, {
          width: thirdW - 16,
          align: 'center',
        });

      doc.y = compY + 58;

      if (dashboard.complaints.totalCases > 0) {
        let dy = doc.y;
        dy = progressBar(
          LEFT,
          dy,
          PAGE_W,
          dashboard.complaints.moralPercent ?? 0,
          ORANGE,
          `Assédio Moral (${dashboard.complaints.moral ?? 0})`,
          `${dashboard.complaints.moralPercent ?? 0}%`,
        );
        dy = progressBar(
          LEFT,
          dy,
          PAGE_W,
          dashboard.complaints.sexualPercent ?? 0,
          RED,
          `Assédio Sexual (${dashboard.complaints.sexual ?? 0})`,
          `${dashboard.complaints.sexualPercent ?? 0}%`,
        );
        const cpcaPct =
          dashboard.complaints.totalCases > 0
            ? pct(
                dashboard.complaints.byCpca ?? 0,
                dashboard.complaints.totalCases,
              )
            : 0;
        const smifPct =
          dashboard.complaints.totalCases > 0
            ? pct(
                dashboard.complaints.bySmif ?? 0,
                dashboard.complaints.totalCases,
              )
            : 0;
        dy = progressBar(
          LEFT,
          dy,
          PAGE_W,
          cpcaPct,
          BLUE,
          `Escopo CPCA (${dashboard.complaints.byCpca ?? 0})`,
          `${cpcaPct}%`,
        );
        dy = progressBar(
          LEFT,
          dy,
          PAGE_W,
          smifPct,
          BLUE_LIGHT,
          `Escopo SMIF (${dashboard.complaints.bySmif ?? 0})`,
          `${smifPct}%`,
        );
        doc.y = dy + 4;
      }

      // ======================== 5. PERFIL DO AGRESSOR ========================
      if (profile.totalCases > 0) {
        doc.addPage();
        sectionHeader('05', 'PERFIL DE ASSÉDIO E VIOLÊNCIA');
        doc.moveDown(0.3);

        const profHalfW = (PAGE_W - 12) / 2;
        const rankingTopY = doc.y;
        let aggressorBottomY = rankingTopY;
        let victimBottomY = rankingTopY;

        if (profile.aggressorProfile?.byRank?.length > 0) {
          doc.roundedRect(LEFT, rankingTopY, profHalfW, 10, 0).fill(BLUE);
          doc
            .fontSize(8)
            .fillColor('#FFFFFF')
            .text(
              'RANKING — Postos/Graduações do Agressor',
              LEFT + 6,
              rankingTopY + 2,
              { width: profHalfW - 12 },
            );
          let ry = rankingTopY + 16;
          const maxC = profile.aggressorProfile.byRank[0]?.count ?? 1;
          for (const [i, item] of profile.aggressorProfile.byRank
            .slice(0, 8)
            .entries()) {
            ry = rankingRow(
              LEFT,
              ry,
              profHalfW,
              i + 1,
              item.label,
              item.count,
              item.percent,
              BLUE,
              maxC,
            );
          }
          aggressorBottomY = ry;
        }

        if (profile.victimProfile?.byRank?.length > 0) {
          const vx = LEFT + profHalfW + 12;
          doc.roundedRect(vx, rankingTopY, profHalfW, 10, 0).fill(RED);
          doc
            .fontSize(8)
            .fillColor('#FFFFFF')
            .text(
              'RANKING — Postos/Graduações da Vítima',
              vx + 6,
              rankingTopY + 2,
              { width: profHalfW - 12 },
            );
          let vy = rankingTopY + 16;
          const maxV = profile.victimProfile.byRank[0]?.count ?? 1;
          for (const [i, item] of profile.victimProfile.byRank
            .slice(0, 8)
            .entries()) {
            vy = rankingRow(
              vx,
              vy,
              profHalfW,
              i + 1,
              item.label,
              item.count,
              item.percent,
              RED,
              maxV,
            );
          }
          victimBottomY = vy;
        }

        doc.y = Math.max(aggressorBottomY, victimBottomY) + 4;

        if (profile.context?.byViolenceType?.length > 0) {
          ensureSpace(80);
          doc.roundedRect(LEFT, doc.y, PAGE_W, 10, 0).fill(ORANGE);
          doc
            .fontSize(8)
            .fillColor('#FFFFFF')
            .text('TIPOS DE VIOLÊNCIA MAIS FREQUENTES', LEFT + 6, doc.y + 2, {
              width: PAGE_W - 12,
            });
          let ty = doc.y + 16;
          const maxT = profile.context.byViolenceType[0]?.count ?? 1;
          for (const [i, item] of profile.context.byViolenceType
            .slice(0, 8)
            .entries()) {
            ty = rankingRow(
              LEFT,
              ty,
              PAGE_W,
              i + 1,
              item.label,
              item.count,
              item.percent,
              ORANGE,
              maxT,
            );
          }
          doc.y = ty + 4;
        }

        ensureSpace(50);
        doc.moveDown(0.3);
        doc.roundedRect(LEFT, doc.y, PAGE_W, 40, 4).fill(BG_LIGHT);
        const insY = doc.y;
        doc
          .fontSize(8)
          .fillColor(BLUE)
          .text('INSIGHT', LEFT + 8, insY + 6, { width: 40 });
        const hierPct = profile.hierarchicalRelation?.percent ?? 0;
        const hierCount = profile.hierarchicalRelation?.count ?? 0;
        doc
          .fontSize(8)
          .fillColor(DARK)
          .text(
            `${hierPct}% dos casos (${hierCount}) envolvem relação hierárquica superior-subordinado. ` +
              `O tipo predominante é Assédio ${(profile.byComplaintType?.moral?.percent ?? 0) > (profile.byComplaintType?.sexual?.percent ?? 0) ? 'Moral' : 'Sexual'} ` +
              `(${Math.max(profile.byComplaintType?.moral?.percent ?? 0, profile.byComplaintType?.sexual?.percent ?? 0)}%).`,
            LEFT + 52,
            insY + 6,
            { width: PAGE_W - 68 },
          );
        doc.y = insY + 48;
      }

      // ======================== 6. ANÁLISE DE TEXTO ========================
      ensureSpace(100);
      sectionHeader('06', 'ANÁLISE DE TEXTO — TERMOS MAIS CITADOS');
      doc.moveDown(0.3);

      const topWords = textData.consolidated.topWords.slice(0, 25);
      if (topWords.length > 0) {
        doc
          .fontSize(8)
          .fillColor(GRAY)
          .text(
            `${textData.consolidated.totalTexts} textos livres analisados de relatórios, sugestões e comentários.`,
          );
        doc.moveDown(0.4);

        const maxWordCount = topWords[0]?.count ?? 1;
        const wordBoxW = PAGE_W;
        let wy = doc.y;
        for (const w of topWords.slice(0, 15)) {
          const barPct = w.count / maxWordCount;
          const barW = Math.max(4, barPct * (wordBoxW * 0.5));
          doc
            .fontSize(8)
            .fillColor(DARK)
            .text(w.word, LEFT, wy, { width: wordBoxW * 0.25 });
          doc
            .roundedRect(LEFT + wordBoxW * 0.25, wy + 1, wordBoxW * 0.5, 8, 3)
            .fill('#E8EAF0');
          const barColor =
            barPct > 0.7 ? BLUE : barPct > 0.4 ? BLUE_LIGHT : '#7BA0D4';
          doc
            .roundedRect(LEFT + wordBoxW * 0.25, wy + 1, barW, 8, 3)
            .fill(barColor);
          doc
            .fontSize(7)
            .fillColor(GRAY)
            .text(String(w.count), LEFT + wordBoxW * 0.78, wy, { width: 40 });
          wy += 13;
          if (wy > 760) {
            doc.addPage();
            wy = doc.y;
          }
        }
        doc.y = wy + 4;

        const sourceLabels: Record<string, string> = {
          recruitsSuggestions: 'Sugestões dos Recrutas',
          reportObservations: 'Observações dos Relatórios',
          reportAttentionPoints: 'Pontos de Atenção',
          reportConclusions: 'Conclusões',
          bestPracticeComments: 'Boas Práticas',
          cpcaComments: 'Comentários CPCA',
        };
        const sourcesWithData = Object.entries(textData.sources)
          .filter(([, d]: [string, any]) => d.count > 0)
          .map(([key, d]: [string, any]) => ({ key, ...d }));

        if (sourcesWithData.length > 0) {
          ensureSpace(60);
          doc.moveDown(0.3);
          doc.fontSize(9).fillColor(BLUE).text('Detalhamento por fonte:');
          doc.moveDown(0.2);

          const srcColW = PAGE_W / Math.min(sourcesWithData.length, 3);
          let sx = LEFT;
          let sy = doc.y;
          for (const [idx, src] of sourcesWithData.entries()) {
            if (idx > 0 && idx % 3 === 0) {
              sx = LEFT;
              sy += 55;
              ensureSpace(55);
            }
            const lbl = sourceLabels[src.key] ?? src.key;
            doc.roundedRect(sx, sy, srcColW - 6, 50, 4).fill(BG_LIGHT);
            doc
              .fontSize(7)
              .fillColor(BLUE)
              .text(lbl, sx + 6, sy + 4, { width: srcColW - 18 });
            doc
              .fontSize(14)
              .fillColor(DARK)
              .text(String(src.count), sx + 6, sy + 16, {
                width: srcColW - 18,
              });
            doc
              .fontSize(6)
              .fillColor(GRAY)
              .text(
                src.topWords
                  .slice(0, 5)
                  .map((w2: any) => w2.word)
                  .join(', '),
                sx + 6,
                sy + 34,
                { width: srcColW - 18 },
              );
            sx += srcColW;
          }
          doc.y = sy + 58;
        }
      } else {
        doc
          .fontSize(9)
          .fillColor(GRAY)
          .text('Nenhum texto disponível para análise.');
      }

      // ======================== 7. MAPA GEOGRÁFICO ========================
      const statesWithData = (geoData.states ?? []).filter(
        (s: any) => Number(s.pressureScore ?? 0) > 0,
      );
      if (statesWithData.length > 0) {
        ensureSpace(120);
        sectionHeader('07', 'DISTRIBUIÇÃO GEOGRÁFICA');
        doc.moveDown(0.3);

        doc
          .fontSize(8)
          .fillColor(GRAY)
          .text(
            `${statesWithData.length} estado(s) com pressão formal ou amostral no período.`,
          );
        doc.moveDown(0.3);

        // Table header
        const cols = [35, 50, 50, 55, 55, 45, PAGE_W - 290];
        const headers = [
          'UF',
          'CPCA',
          'SMIF',
          'Escolas',
          'VD 12m',
          'Atividades',
          'Missões',
          'Pressão',
        ];
        let tx = LEFT;
        const thY = doc.y;
        doc.rect(LEFT, thY, PAGE_W, 14).fill(BLUE);
        for (const [ci, hdr] of headers.entries()) {
          doc
            .fontSize(7)
            .fillColor('#FFFFFF')
            .text(hdr, tx + 3, thY + 3, { width: cols[ci] - 6 });
          tx += cols[ci];
        }
        doc.y = thY + 16;

        for (const [ri, s] of statesWithData.slice(0, 15).entries()) {
          ensureSpace(14);
          const rowY = doc.y;
          if (ri % 2 === 0) doc.rect(LEFT, rowY, PAGE_W, 13).fill(BG_LIGHT);
          let rx = LEFT;
          const vals = [
            s.uf,
            String(s.cpcaComplaints ?? s.complaints ?? 0),
            String(s.smifComplaints ?? 0),
            `${s.schoolSurveyYes ?? 0}/${s.schoolSurveyTotal ?? 0}`,
            `${s.domesticLast12MonthsYes ?? 0}/${s.domesticSurveyTotal ?? 0}`,
            String(s.activities),
            String(s.missions),
            Number(s.pressureScore ?? 0).toFixed(1),
          ];
          for (const [ci, val] of vals.entries()) {
            doc
              .fontSize(7)
              .fillColor(DARK)
              .text(val, rx + 3, rowY + 3, { width: cols[ci] - 6 });
            rx += cols[ci];
          }
          doc.y = rowY + 14;
        }
        if (statesWithData.length > 15) {
          doc
            .fontSize(7)
            .fillColor(GRAY)
            .text(`... e mais ${statesWithData.length - 15} estado(s).`);
        }

        const topByComplaints = [...statesWithData].sort(
          (a: any, b: any) => b.complaints - a.complaints,
        )[0];
        const topByActivities = [...statesWithData].sort(
          (a: any, b: any) => b.activities - a.activities,
        )[0];
        const topByMissions = [...statesWithData].sort(
          (a: any, b: any) => b.missions - a.missions,
        )[0];
        const topByPressure = [...statesWithData].sort(
          (a: any, b: any) =>
            Number(b.pressureScore ?? 0) - Number(a.pressureScore ?? 0),
        )[0];

        if (
          (topByComplaints?.complaints ?? 0) > 0 ||
          Number(topByPressure?.pressureScore ?? 0) > 0 ||
          (topByActivities?.activities ?? 0) > 0 ||
          (topByMissions?.missions ?? 0) > 0
        ) {
          doc.moveDown(0.4);
          doc
            .fontSize(7)
            .fillColor(GRAY)
            .text(
              `Destaques por UF — Denúncias: ${topByComplaints?.uf ?? '-'} (${topByComplaints?.complaints ?? 0}) | ` +
                `Pressão: ${topByPressure?.uf ?? '-'} (${Number(topByPressure?.pressureScore ?? 0).toFixed(1)}) | ` +
                `Atividades: ${topByActivities?.uf ?? '-'} (${topByActivities?.activities ?? 0}) | ` +
                `Missões: ${topByMissions?.uf ?? '-'} (${topByMissions?.missions ?? 0}) como cobertura inicial.`,
            );
        }
      }

      // ======================== FOOTER ========================
      doc.moveDown(1.5);
      ensureSpace(30);
      doc
        .moveTo(LEFT, doc.y)
        .lineTo(RIGHT, doc.y)
        .strokeColor('#E0E0E0')
        .lineWidth(0.5)
        .stroke();
      doc.moveDown(0.3);
      doc
        .fontSize(7)
        .fillColor(GRAY)
        .text(
          'DOCUMENTO RESTRITO — USO INTERNO  |  Sistema de Gestão CIPAVD/SMIF  |  Força Aérea Brasileira',
          { align: 'center' },
        );
      doc
        .fontSize(6)
        .fillColor('#999999')
        .text(
          `Gerado automaticamente em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}. Dados sujeitos a atualização.`,
          { align: 'center' },
        );

      doc.end();
    });
  }

  private async getSurveyKpis(filters?: StrategicSourceFilter) {
    const sourceSet = this.resolveSourceSet(filters?.sources);
    const emptyDetails = {
      total: [] as StrategicKpiDetailItem[],
      yes: [] as StrategicKpiDetailItem[],
      no: [] as StrategicKpiDetailItem[],
    };
    const emptyCoverage = this.summarizeBiNormalizationCoverage({
      sourceLabel: 'Pesquisa de escolas de formação',
      populationLabel:
        'Alunos e efetivo vinculado às escolas/localidades de formação visitadas',
      totalRecords: 0,
      links: [],
    });
    if (!this.hasSurveySources(sourceSet)) {
      return {
        totalResponses: 0,
        violenceRatePercent: 0,
        yesCount: 0,
        noCount: 0,
        coverage: emptyCoverage,
        details: emptyDetails,
      };
    }

    const where = {};
    try {
      const model = (this.prisma as any).biSurveyResponse;
      const [rows, links] = await Promise.all([
        model.findMany({
          where,
          orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            sourceRow: true,
            submittedAt: true,
            om: true,
            postoGraduacao: true,
            posto: true,
            sufferedViolence: true,
          },
        }),
        this.prisma.biNormalizationLink.findMany({
          where: { sourceType: 'SURVEY_SCHOOLS' },
          select: {
            sourceRecordId: true,
            omId: true,
            uf: true,
            status: true,
            om: {
              select: {
                uf: true,
              },
            },
          },
        }),
      ]);
      const coverage = this.summarizeBiNormalizationCoverage({
        sourceLabel: 'Pesquisa de escolas de formação',
        populationLabel:
          'Alunos e efetivo vinculado às escolas/localidades de formação visitadas',
        totalRecords: rows.length,
        links,
      });
      if (rows.length === 0)
        return {
          totalResponses: 0,
          violenceRatePercent: 0,
          yesCount: 0,
          noCount: 0,
          coverage,
          details: emptyDetails,
        };

      const toDetail = (row: any): StrategicKpiDetailItem => {
        const id = String(row?.id ?? '').trim();
        const sourceRow = Number(row?.sourceRow ?? 0);
        const title =
          sourceRow > 0
            ? `Resposta linha ${sourceRow}`
            : `Resposta ${id.slice(0, 8) || 'BI'}`;
        const subtitle = [
          String(row?.om ?? '').trim(),
          String(row?.postoGraduacao ?? '').trim(),
          String(row?.posto ?? '').trim(),
        ]
          .filter(Boolean)
          .join(' • ');
        return {
          id: id || `survey-${sourceRow}`,
          title,
          subtitle: subtitle || undefined,
          date: row?.submittedAt?.toISOString?.() ?? undefined,
          badge:
            row?.sufferedViolence === true
              ? 'SIM'
              : row?.sufferedViolence === false
                ? 'NÃO'
                : 'N/I',
          link: `/dashboard/bi?responseId=${encodeURIComponent(id)}`,
        };
      };

      const totalDetails = rows.map((row: any) => toDetail(row));
      const yesDetails = rows
        .filter((row: any) => row?.sufferedViolence === true)
        .map((row: any) => toDetail(row));
      const noDetails = rows
        .filter((row: any) => row?.sufferedViolence !== true)
        .map((row: any) => toDetail(row));

      const total = totalDetails.length;
      const yesCount = yesDetails.length;
      return {
        totalResponses: total,
        yesCount,
        noCount: total - yesCount,
        violenceRatePercent: pct(yesCount, total),
        coverage,
        details: {
          total: totalDetails,
          yes: yesDetails,
          no: noDetails,
        },
      };
    } catch {
      return {
        totalResponses: 0,
        violenceRatePercent: 0,
        yesCount: 0,
        noCount: 0,
        coverage: emptyCoverage,
        details: emptyDetails,
      };
    }
  }

  private async getDomesticViolenceKpis(filters?: StrategicSourceFilter) {
    const sourceSet = this.resolveSourceSet(filters?.sources);
    const emptyDetails = {
      total: [] as StrategicKpiDetailItem[],
      lifetimeYes: [] as StrategicKpiDetailItem[],
      last12MonthsYes: [] as StrategicKpiDetailItem[],
      soughtHelp: [] as StrategicKpiDetailItem[],
    };
    const emptyCoverage = this.summarizeBiNormalizationCoverage({
      sourceLabel: 'Pesquisa de violência doméstica',
      populationLabel: 'Efetivo feminino geral da FAB respondente',
      totalRecords: 0,
      links: [],
    });
    if (!this.hasDomesticViolenceSources(sourceSet)) {
      return {
        totalResponses: 0,
        lifetimeRatePercent: 0,
        last12MonthsRatePercent: 0,
        soughtHelpPercent: 0,
        coverage: emptyCoverage,
        details: emptyDetails,
      };
    }

    const where = {};
    try {
      const model = (this.prisma as any).biDomesticViolenceResponse;
      const [rows, links] = await Promise.all([
        model.findMany({
          where,
          orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            sourceRow: true,
            submittedAt: true,
            organization: true,
            rank: true,
            sufferedLifetime: true,
            sufferedLast12Months: true,
            soughtHelp: true,
          },
        }),
        this.prisma.biNormalizationLink.findMany({
          where: { sourceType: 'DOMESTIC_VIOLENCE' },
          select: {
            sourceRecordId: true,
            omId: true,
            uf: true,
            status: true,
            om: {
              select: {
                uf: true,
              },
            },
          },
        }),
      ]);
      const coverage = this.summarizeBiNormalizationCoverage({
        sourceLabel: 'Pesquisa de violência doméstica',
        populationLabel: 'Efetivo feminino geral da FAB respondente',
        totalRecords: rows.length,
        links,
      });
      if (rows.length === 0)
        return {
          totalResponses: 0,
          lifetimeRatePercent: 0,
          last12MonthsRatePercent: 0,
          soughtHelpPercent: 0,
          coverage,
          details: emptyDetails,
        };

      const toDetail = (row: any): StrategicKpiDetailItem => {
        const id = String(row?.id ?? '').trim();
        const sourceRow = Number(row?.sourceRow ?? 0);
        const title =
          String(row?.organization ?? '').trim() ||
          (sourceRow > 0
            ? `Resposta linha ${sourceRow}`
            : `Resposta ${id.slice(0, 8) || 'BI'}`);
        return {
          id: id || `domestic-${sourceRow}`,
          title,
          subtitle: String(row?.rank ?? '').trim() || undefined,
          date: row?.submittedAt?.toISOString?.() ?? undefined,
          link: `/dashboard/bi-violencia-domestica?responseId=${encodeURIComponent(id)}`,
        };
      };

      const totalDetails = rows.map((row: any) => toDetail(row));
      const lifetimeYesDetails = rows
        .filter((row: any) => row?.sufferedLifetime === true)
        .map((row: any) => toDetail(row));
      const last12MonthsYesDetails = rows
        .filter((row: any) => row?.sufferedLast12Months === true)
        .map((row: any) => toDetail(row));
      const soughtHelpDetails = rows
        .filter((row: any) => row?.soughtHelp === true)
        .map((row: any) => toDetail(row));

      const total = totalDetails.length;
      const lifetimeYes = lifetimeYesDetails.length;
      const last12Yes = last12MonthsYesDetails.length;
      const soughtHelp = soughtHelpDetails.length;

      return {
        totalResponses: total,
        lifetimeYes,
        lifetimeRatePercent: pct(lifetimeYes, total),
        last12MonthsYes: last12Yes,
        last12MonthsRatePercent: pct(last12Yes, total),
        soughtHelp,
        soughtHelpPercent: pct(
          soughtHelp,
          lifetimeYes > 0 ? lifetimeYes : total,
        ),
        coverage,
        details: {
          total: totalDetails,
          lifetimeYes: lifetimeYesDetails,
          last12MonthsYes: last12MonthsYesDetails,
          soughtHelp: soughtHelpDetails,
        },
      };
    } catch {
      return {
        totalResponses: 0,
        lifetimeRatePercent: 0,
        last12MonthsRatePercent: 0,
        soughtHelpPercent: 0,
        coverage: emptyCoverage,
        details: emptyDetails,
      };
    }
  }

  private async getRecruitsKpis(filters?: StrategicSourceFilter) {
    const sourceSet = this.resolveSourceSet(filters?.sources);
    const emptyDetails = {
      total: [] as StrategicKpiDetailItem[],
      safe: [] as StrategicKpiDetailItem[],
      knowReportProcess: [] as StrategicKpiDetailItem[],
    };
    if (!this.hasRecruitSources(sourceSet)) {
      return {
        totalResponses: 0,
        safeToReportPercent: 0,
        knowReportProcessPercent: 0,
        details: emptyDetails,
      };
    }

    const where = {};
    try {
      const model = (this.prisma as any).biRecruitsResponse;
      const rows = await model.findMany({
        where,
        orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          sourceRow: true,
          submittedAt: true,
          education: true,
          gender: true,
          willingnessReport: true,
          knowReportProcess: true,
        },
      });

      if (rows.length === 0)
        return {
          totalResponses: 0,
          safeToReportPercent: 0,
          knowReportProcessPercent: 0,
          details: emptyDetails,
        };

      const toDetail = (row: any): StrategicKpiDetailItem => {
        const id = String(row?.id ?? '').trim();
        const sourceRow = Number(row?.sourceRow ?? 0);
        const title =
          sourceRow > 0
            ? `Resposta linha ${sourceRow}`
            : `Resposta ${id.slice(0, 8) || 'BI'}`;
        const subtitle = [
          String(row?.education ?? '').trim(),
          String(row?.gender ?? '').trim(),
        ]
          .filter(Boolean)
          .join(' • ');
        const badge = [
          String(row?.willingnessReport ?? '').trim(),
          String(row?.knowReportProcess ?? '').trim(),
        ]
          .filter(Boolean)
          .join(' | ');
        return {
          id: id || `recruit-${sourceRow}`,
          title,
          subtitle: subtitle || undefined,
          date: row?.submittedAt?.toISOString?.() ?? undefined,
          badge: badge || undefined,
          link: `/dashboard/bi-recrutas?responseId=${encodeURIComponent(id)}`,
        };
      };

      const totalDetails = rows.map((row: any) => toDetail(row));
      const safeDetails = rows
        .filter((row: any) => row?.willingnessReport === 'Seguro(a)')
        .map((row: any) => toDetail(row));
      const knowDetails = rows
        .filter((row: any) => row?.knowReportProcess === 'Sim')
        .map((row: any) => toDetail(row));
      const safeCount = safeDetails.length;
      const knowProcess = knowDetails.length;
      const total = totalDetails.length;

      return {
        totalResponses: total,
        safeCount,
        safeToReportPercent: pct(safeCount, total),
        knowProcess,
        knowReportProcessPercent: pct(knowProcess, total),
        details: {
          total: totalDetails,
          safe: safeDetails,
          knowReportProcess: knowDetails,
        },
      };
    } catch {
      return {
        totalResponses: 0,
        safeToReportPercent: 0,
        knowReportProcessPercent: 0,
        details: emptyDetails,
      };
    }
  }

  private async getComplaintsKpis(filters?: StrategicSourceFilter) {
    const sourceSet = this.resolveSourceSet(filters?.sources);
    const emptyDetails = {
      total: [] as StrategicKpiDetailItem[],
      open: [] as StrategicKpiDetailItem[],
      concluded: [] as StrategicKpiDetailItem[],
      cpca: [] as StrategicKpiDetailItem[],
      smif: [] as StrategicKpiDetailItem[],
      cpcaOpen: [] as StrategicKpiDetailItem[],
      smifOpen: [] as StrategicKpiDetailItem[],
      moral: [] as StrategicKpiDetailItem[],
      sexual: [] as StrategicKpiDetailItem[],
    };
    if (!this.hasComplaintSources(sourceSet)) {
      return {
        totalCases: 0,
        openCases: 0,
        concludedCases: 0,
        byCpca: 0,
        bySmif: 0,
        openByCpca: 0,
        openBySmif: 0,
        moral: 0,
        sexual: 0,
        moralPercent: 0,
        sexualPercent: 0,
        details: emptyDetails,
      };
    }

    const complaintScopes = this.buildComplaintScopeFilter(sourceSet);
    const where =
      complaintScopes.length > 0
        ? { workflowScope: { in: complaintScopes } }
        : {};
    try {
      const model = (this.prisma as any).cpcComplaintCase;
      const rows = await model.findMany({
        where,
        orderBy: [{ reportedAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          caseNumber: true,
          workflowScope: true,
          status: true,
          complaintType: true,
          reportedAt: true,
          locality: { select: { name: true } },
        },
      });
      const openStatuses = new Set([
        'RECEIVED',
        'PROTECTION_MEASURES',
        'PRELIMINARY_ANALYSIS',
        'PROCEDURE_DEFINED',
        'INVESTIGATION',
      ]);
      const toDetail = (row: any): StrategicKpiDetailItem => {
        const id = String(row?.id ?? '').trim();
        const caseNumber = String(row?.caseNumber ?? '').trim();
        const scope = String(row?.workflowScope ?? 'CPCA')
          .trim()
          .toUpperCase();
        const link =
          scope === 'SMIF'
            ? `/smif-complaints?q=${encodeURIComponent(caseNumber)}`
            : `/cpca-cases?q=${encodeURIComponent(caseNumber)}`;
        return {
          id: id || `complaint-${caseNumber}`,
          title: caseNumber ? `Denúncia ${caseNumber}` : 'Denúncia',
          subtitle: [scope, String(row?.locality?.name ?? '').trim()]
            .filter(Boolean)
            .join(' • '),
          date: row?.reportedAt?.toISOString?.() ?? undefined,
          badge: String(row?.status ?? '').trim() || undefined,
          link,
        };
      };

      const totalDetails = rows.map((row: any) => toDetail(row));
      const openDetails = rows
        .filter((row: any) =>
          openStatuses.has(String(row?.status ?? '').trim()),
        )
        .map((row: any) => toDetail(row));
      const concludedDetails = rows
        .filter(
          (row: any) => !openStatuses.has(String(row?.status ?? '').trim()),
        )
        .map((row: any) => toDetail(row));
      const cpcaDetails = rows
        .filter(
          (row: any) =>
            String(row?.workflowScope ?? '')
              .trim()
              .toUpperCase() === 'CPCA',
        )
        .map((row: any) => toDetail(row));
      const smifDetails = rows
        .filter(
          (row: any) =>
            String(row?.workflowScope ?? '')
              .trim()
              .toUpperCase() === 'SMIF',
        )
        .map((row: any) => toDetail(row));
      const cpcaOpenDetails = rows
        .filter(
          (row: any) =>
            String(row?.workflowScope ?? '')
              .trim()
              .toUpperCase() === 'CPCA' &&
            openStatuses.has(String(row?.status ?? '').trim()),
        )
        .map((row: any) => toDetail(row));
      const smifOpenDetails = rows
        .filter(
          (row: any) =>
            String(row?.workflowScope ?? '')
              .trim()
              .toUpperCase() === 'SMIF' &&
            openStatuses.has(String(row?.status ?? '').trim()),
        )
        .map((row: any) => toDetail(row));
      const moralDetails = rows
        .filter(
          (row: any) =>
            String(row?.complaintType ?? '')
              .trim()
              .toUpperCase() === 'MORAL',
        )
        .map((row: any) => toDetail(row));
      const sexualDetails = rows
        .filter(
          (row: any) =>
            String(row?.complaintType ?? '')
              .trim()
              .toUpperCase() === 'SEXUAL',
        )
        .map((row: any) => toDetail(row));

      const total = totalDetails.length;
      const openCases = openDetails.length;
      const byCpca = cpcaDetails.length;
      const bySmif = smifDetails.length;
      const moral = moralDetails.length;
      const sexual = sexualDetails.length;

      return {
        totalCases: total,
        openCases,
        concludedCases: total - openCases,
        byCpca,
        bySmif,
        openByCpca: cpcaOpenDetails.length,
        openBySmif: smifOpenDetails.length,
        moral,
        sexual,
        moralPercent: pct(moral, total),
        sexualPercent: pct(sexual, total),
        details: {
          total: totalDetails,
          open: openDetails,
          concluded: concludedDetails,
          cpca: cpcaDetails,
          smif: smifDetails,
          cpcaOpen: cpcaOpenDetails,
          smifOpen: smifOpenDetails,
          moral: moralDetails,
          sexual: sexualDetails,
        },
      };
    } catch {
      return {
        totalCases: 0,
        openCases: 0,
        concludedCases: 0,
        byCpca: 0,
        bySmif: 0,
        openByCpca: 0,
        openBySmif: 0,
        moral: 0,
        sexual: 0,
        moralPercent: 0,
        sexualPercent: 0,
        details: emptyDetails,
      };
    }
  }

  private async getActivitiesKpis(filters?: StrategicSourceFilter) {
    const sourceSet = this.resolveSourceSet(filters?.sources);
    const scopeFilter = this.buildActivityScopeFilter(sourceSet);
    const emptyDetails = {
      total: [],
      smif: [],
      cipavd: [],
      done: [],
      withReport: [],
      signed: [],
    };
    if (!this.hasActivitySource(sourceSet)) {
      return {
        totalActivities: 0,
        done: 0,
        smif: 0,
        cipavd: 0,
        withReport: 0,
        signed: 0,
        details: emptyDetails,
      };
    }

    const where = scopeFilter ? { scope: scopeFilter } : {};
    try {
      const activities = await this.prisma.activity.findMany({
        where,
        orderBy: [{ eventDate: 'desc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          title: true,
          scope: true,
          status: true,
          eventDate: true,
          locality: { select: { name: true } },
          report: { select: { id: true, signedAt: true } },
        },
      });

      const toLink = (
        activity: {
          id: string;
          scope: ActivityScope;
        },
        tab?: 'report',
      ) => {
        const route =
          activity.scope === 'CIPAVD' ? '/activities-cipavd' : '/activities';
        const qs = new URLSearchParams({ activityId: activity.id });
        if (tab === 'report') qs.set('tab', 'report');
        return `${route}?${qs.toString()}`;
      };

      const toDetail = (
        activity: {
          id: string;
          title: string;
          scope: ActivityScope;
          status: string;
          eventDate: Date | null;
          locality: { name: string } | null;
        },
        tab?: 'report',
      ) => ({
        id: activity.id,
        title:
          String(activity.title ?? '').trim() || `Atividade ${activity.id}`,
        scope: activity.scope,
        status: activity.status,
        date: activity.eventDate?.toISOString() ?? '',
        locality: activity.locality?.name ?? '',
        link: toLink(activity, tab),
      });

      const totalDetails = activities.map((activity) => toDetail(activity));
      const smifDetails = activities
        .filter((activity) => activity.scope === 'SMIF')
        .map((activity) => toDetail(activity));
      const cipavdDetails = activities
        .filter((activity) => activity.scope === 'CIPAVD')
        .map((activity) => toDetail(activity));
      const doneDetails = activities
        .filter((activity) => activity.status === 'DONE')
        .map((activity) => toDetail(activity));
      const withReportDetails = activities
        .filter((activity) => Boolean(activity.report))
        .map((activity) => toDetail(activity, 'report'));
      const signedDetails = activities
        .filter((activity) => Boolean(activity.report?.signedAt))
        .map((activity) => toDetail(activity, 'report'));

      return {
        totalActivities: totalDetails.length,
        done: doneDetails.length,
        smif: smifDetails.length,
        cipavd: cipavdDetails.length,
        withReport: withReportDetails.length,
        signed: signedDetails.length,
        details: {
          total: totalDetails,
          smif: smifDetails,
          cipavd: cipavdDetails,
          done: doneDetails,
          withReport: withReportDetails,
          signed: signedDetails,
        },
      };
    } catch {
      return {
        totalActivities: 0,
        done: 0,
        smif: 0,
        cipavd: 0,
        withReport: 0,
        signed: 0,
        details: emptyDetails,
      };
    }
  }

  private async getMissionsKpis(filters?: StrategicSourceFilter) {
    const sourceSet = this.resolveSourceSet(filters?.sources);
    const emptyDetails = {
      total: [] as StrategicKpiDetailItem[],
      smif: [] as StrategicKpiDetailItem[],
      cipavd: [] as StrategicKpiDetailItem[],
      localitiesCovered: [] as StrategicKpiDetailItem[],
    };
    if (!this.hasMissionSource(sourceSet)) {
      return {
        totalMissions: 0,
        smif: 0,
        cipavd: 0,
        localitiesCovered: 0,
        details: emptyDetails,
      };
    }

    const where = {};
    try {
      const model = (this.prisma as any).mission;
      const rows = await model.findMany({
        where,
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          title: true,
          scope: true,
          startDate: true,
          endDate: true,
          localityId: true,
          locality: { select: { name: true } },
        },
      });

      const toDetail = (row: any): StrategicKpiDetailItem => {
        const missionId = String(row?.id ?? '').trim();
        const scope = String(row?.scope ?? 'SMIF')
          .trim()
          .toUpperCase();
        return {
          id: missionId || `mission-${row?.title ?? ''}`,
          title:
            String(row?.title ?? '').trim() ||
            `Missão ${missionId || 'sem-id'}`,
          subtitle: [scope, String(row?.locality?.name ?? '').trim()]
            .filter(Boolean)
            .join(' • '),
          date: row?.startDate?.toISOString?.() ?? undefined,
          link: `/missions?missionId=${encodeURIComponent(missionId)}&scope=${encodeURIComponent(scope)}`,
        };
      };

      const totalDetails = rows.map((row: any) => toDetail(row));
      const smifDetails = rows
        .filter(
          (row: any) =>
            String(row?.scope ?? '')
              .trim()
              .toUpperCase() === 'SMIF',
        )
        .map((row: any) => toDetail(row));
      const cipavdDetails = rows
        .filter(
          (row: any) =>
            String(row?.scope ?? '')
              .trim()
              .toUpperCase() === 'CIPAVD',
        )
        .map((row: any) => toDetail(row));

      const localities = new Map<
        string,
        {
          id: string;
          name: string;
          total: number;
          smif: number;
          cipavd: number;
        }
      >();
      for (const row of rows as any[]) {
        const localityId = String(row?.localityId ?? '').trim();
        if (!localityId) continue;
        if (!localities.has(localityId)) {
          localities.set(localityId, {
            id: localityId,
            name: String(row?.locality?.name ?? '').trim() || localityId,
            total: 0,
            smif: 0,
            cipavd: 0,
          });
        }
        const entry = localities.get(localityId)!;
        entry.total += 1;
        const scope = String(row?.scope ?? '')
          .trim()
          .toUpperCase();
        if (scope === 'CIPAVD') entry.cipavd += 1;
        else entry.smif += 1;
      }
      const localitiesDetails = Array.from(localities.values())
        .sort((a, b) => b.total - a.total)
        .map((entry) => {
          const scope = entry.cipavd > entry.smif ? 'CIPAVD' : 'SMIF';
          return {
            id: `mission-locality-${entry.id}`,
            title: entry.name,
            subtitle: `SMIF: ${entry.smif} • CIPAVD: ${entry.cipavd}`,
            badge: String(entry.total),
            link: `/missions?localityId=${encodeURIComponent(entry.id)}&scope=${scope}`,
          };
        });

      return {
        totalMissions: totalDetails.length,
        smif: smifDetails.length,
        cipavd: cipavdDetails.length,
        localitiesCovered: localitiesDetails.length,
        details: {
          total: totalDetails,
          smif: smifDetails,
          cipavd: cipavdDetails,
          localitiesCovered: localitiesDetails,
        },
      };
    } catch {
      return {
        totalMissions: 0,
        smif: 0,
        cipavd: 0,
        localitiesCovered: 0,
        details: emptyDetails,
      };
    }
  }

  private async getTaskKpis(filters?: StrategicSourceFilter) {
    const sourceSet = this.resolveSourceSet(filters?.sources);
    if (!this.hasTaskSource(sourceSet)) {
      return {
        totalTasks: 0,
        totalOverdue: 0,
        completed: 0,
        pending: 0,
      };
    }

    const now = new Date();
    try {
      const model = this.prisma.taskInstance;
      const totalTasks = await model.count();
      const completed = await model.count({ where: { status: 'DONE' } });
      const totalOverdue = await model.count({
        where: {
          status: { not: 'DONE' },
          dueDate: { lt: now },
        },
      });
      return {
        totalTasks,
        totalOverdue,
        completed,
        pending: Math.max(0, totalTasks - completed),
      };
    } catch {
      return {
        totalTasks: 0,
        totalOverdue: 0,
        completed: 0,
        pending: 0,
      };
    }
  }
}
