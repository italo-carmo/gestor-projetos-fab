import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  LitellmService,
  LITELLM_API_KEY_ENV_KEYS,
  LITELLM_BASE_URL_ENV_KEYS,
} from '../llm/litellm.service';
import PDFDocument from 'pdfkit';

const PT_STOPWORDS = new Set([
  'a','à','ao','aos','aquela','aquelas','aquele','aqueles','aquilo','as','até',
  'com','como','da','das','de','dela','delas','dele','deles','depois','do','dos',
  'e','é','ela','elas','ele','eles','em','entre','era','essa','essas','esse',
  'esses','esta','estas','este','estes','eu','foi','for','foram','ha','há','isso',
  'isto','já','lhe','lhes','lo','mais','mas','me','mesmo','meu','minha','muito',
  'na','nas','não','nao','nem','no','nos','nós','nossa','nosso','num','numa','o',
  'os','ou','para','pela','pelas','pelo','pelos','por','qual','quando','que','quem',
  'se','sem','ser','seu','sua','são','só','também','te','tem','tenho','ter','teu',
  'ti','todo','todos','tu','tua','tudo','um','uma','umas','uns','vai','vão','você',
  'vocês','vos','nessa','nesse','nessas','nesses','nesta','neste','nestas','nestes',
  'sobre','ainda','então','onde','aqui','ali','lá','cá','sim','pode','pode','fazer',
  'feito','ter','sido','sendo','tendo','seria','suas','seus','meus','minhas',
  'dele','dela','deles','delas','nossos','nossas','todo','toda','todas','cada',
  'outra','outro','outras','outros','algum','alguma','alguns','algumas','nenhum',
  'nenhuma','nenhuns','nenhumas','tanto','tanta','tantos','tantas','esse','essa',
  'esses','essas','este','esta','estes','estas','aquele','aquela','aqueles','aquelas',
  'quanto','quanta','quantos','quantas','qual','quais','que','quem','onde',
  'porque','pois','como','assim','porém','contudo','entretanto','todavia',
  'mas','embora','embora','senão','caso','desde','durante','através','após',
  'antes','depois','enquanto','logo','pra','pro','dos','das','nos','nas',
  'num','numa','nuns','numas','dum','duma','duns','dumas','pelo','pela',
  'pelos','pelas','sim','não','nao','talvez','jamais','sempre','nunca',
  'apenas','somente','quase','bastante','demais','menos','pouco','poucos',
  'muita','muitas','muitos','muito','tão','tanto','tanta','tantos','tantas',
  'maior','menor','melhor','pior','bem','mal','bom','boa','bons','boas',
  'grande','grandes','pequeno','pequena','pequenos','pequenas',
  'parte','forma','vez','vezes','dia','dias','ano','anos','mês','tempo',
  'coisa','coisas','pessoa','pessoas','gente','homem','mulher','vida',
  'mundo','casa','exemplo','tipo','lado','modo','conta','ponto','fato','falta',
]);

function tokenizeAndCount(texts: string[], minLen = 3): { word: string; count: number }[] {
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

function countByField(items: any[], field: string): { label: string; count: number; percent: number }[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const val = String(item[field] ?? 'Não informado').trim() || 'Não informado';
    map.set(val, (map.get(val) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count, percent: pct(count, items.length) }))
    .sort((a, b) => b.count - a.count);
}

type AiAnalysisType = 'executive' | 'situational' | 'aggressor' | 'text' | 'geo';

export type AiSourceReference = {
  id: string;
  label: string;
  href: string;
  description?: string;
};

@Injectable()
export class StrategicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly litellm: LitellmService,
  ) {}

  async situationalDashboard() {
    const [
      surveyData,
      domesticViolenceData,
      recruitsData,
      complaintsData,
      activitiesData,
      missionsData,
      localities,
    ] = await Promise.all([
      this.getSurveyKpis(),
      this.getDomesticViolenceKpis(),
      this.getRecruitsKpis(),
      this.getComplaintsKpis(),
      this.getActivitiesKpis(),
      this.getMissionsKpis(),
      this.prisma.locality.findMany({ select: { id: true, code: true, name: true } }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      surveys: surveyData,
      domesticViolence: domesticViolenceData,
      recruits: recruitsData,
      complaints: complaintsData,
      activities: activitiesData,
      missions: missionsData,
      localityCount: localities.length,
    };
  }

  async geoMap() {
    const localities = await this.prisma.locality.findMany({
      select: { id: true, code: true, name: true, uf: true, catalogType: true },
    });

    const [complaints, activities, missions] = await Promise.all([
      (this.prisma as any).cpcComplaintCase.findMany({
        select: {
          localityId: true, caseNumber: true, complaintType: true,
          status: true, reportedAt: true, workflowScope: true,
          locality: { select: { name: true } },
        },
      }).catch(() => []),
      this.prisma.activity.findMany({
        select: {
          localityId: true, title: true, scope: true,
          status: true, eventDate: true,
          locality: { select: { name: true } },
        },
      }),
      (this.prisma as any).mission.findMany({
        select: {
          localityId: true, title: true, scope: true,
          startDate: true, endDate: true,
          locality: { select: { name: true } },
        },
      }).catch(() => []),
    ]);

    type StateEntry = {
      uf: string;
      complaints: number;
      activities: number;
      missions: number;
      localities: string[];
      complaintDetails: { caseNumber: string; type: string; status: string; date: string; locality: string; scope: string }[];
      activityDetails: { title: string; scope: string; status: string; date: string; locality: string }[];
      missionDetails: { title: string; scope: string; startDate: string; endDate: string; locality: string }[];
    };

    const ufMap = new Map<string, StateEntry>();

    const locUfMap = new Map<string, string>();
    for (const loc of localities) {
      if (loc.uf) locUfMap.set(loc.id, loc.uf);
    }

    const ensureUf = (uf: string): StateEntry => {
      if (!ufMap.has(uf)) {
        ufMap.set(uf, {
          uf, complaints: 0, activities: 0, missions: 0,
          localities: [], complaintDetails: [], activityDetails: [], missionDetails: [],
        });
      }
      return ufMap.get(uf)!;
    };

    for (const loc of localities) {
      if (loc.uf) {
        const entry = ensureUf(loc.uf);
        entry.localities.push(loc.name);
      }
    }

    for (const c of complaints) {
      const uf = locUfMap.get(c.localityId);
      if (uf) {
        const entry = ensureUf(uf);
        entry.complaints++;
        entry.complaintDetails.push({
          caseNumber: c.caseNumber,
          type: c.complaintType,
          status: c.status,
          date: c.reportedAt?.toISOString?.() ?? '',
          locality: c.locality?.name ?? '',
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

    return {
      generatedAt: new Date().toISOString(),
      states: Array.from(ufMap.values()).sort((a, b) => {
        const totalA = a.complaints + a.activities + a.missions;
        const totalB = b.complaints + b.activities + b.missions;
        return totalB - totalA;
      }),
      totalLocalitiesWithUf: localities.filter((l) => l.uf).length,
      totalLocalities: localities.length,
    };
  }

  async aggressorProfile() {
    const complaintModel = (this.prisma as any).cpcComplaintCase;
    const cases = await complaintModel.findMany({
      select: {
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
        workflowScope: true,
        status: true,
        localityId: true,
        locality: { select: { code: true, name: true } },
      },
    });

    const totalCases = cases.length;
    if (totalCases === 0) {
      return { totalCases: 0, message: 'Nenhum caso registrado.' };
    }

    const moralCases = cases.filter((c: any) => c.complaintType === 'MORAL');
    const sexualCases = cases.filter((c: any) => c.complaintType === 'SEXUAL');

    const hierarchicalCount = cases.filter(
      (c: any) =>
        c.hierarchicalFunctionalRelation &&
        /superior|chefia|comando|hierarq/i.test(c.hierarchicalFunctionalRelation),
    ).length;

    const byScope = countByField(cases, 'workflowScope');

    const crossTab: { complaintType: string; aggressorGender: string; victimGender: string; count: number }[] = [];
    const crossMap = new Map<string, number>();
    for (const c of cases) {
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
        moral: { count: moralCases.length, percent: pct(moralCases.length, totalCases) },
        sexual: { count: sexualCases.length, percent: pct(sexualCases.length, totalCases) },
      },
      hierarchicalRelation: {
        count: hierarchicalCount,
        percent: pct(hierarchicalCount, totalCases),
        description: 'Casos onde o agressor é superior hierárquico da vítima',
      },
      aggressorProfile: {
        byRank: countByField(cases, 'aggressorRank'),
        byGender: countByField(cases, 'aggressorGender'),
        byAgeRange: countByField(cases, 'aggressorAgeRange'),
      },
      victimProfile: {
        byRank: countByField(cases, 'victimRank'),
        byGender: countByField(cases, 'victimGender'),
        byAgeRange: countByField(cases, 'victimAgeRange'),
      },
      context: {
        byViolenceType: countByField(cases, 'detailedViolenceType'),
        byHarassmentContext: countByField(cases, 'harassmentContext'),
        byLocation: countByField(cases, 'occurrenceLocation'),
        byFrequency: countByField(cases, 'incidentFrequency'),
        byForm: countByField(cases, 'occurrenceForm'),
      },
      crossTabulation: crossTab,
      byScope,
      byLocality: countByField(cases, 'localityId').map((item) => {
        const loc = cases.find((c: any) => c.localityId === item.label)?.locality;
        return { ...item, localityCode: loc?.code ?? '', localityName: loc?.name ?? item.label };
      }),
    };
  }

  async textAnalysis() {
    const [
      recruitsResponses,
      activityReports,
      bestPracticeCycleResponses,
      cpcaComments,
    ] = await Promise.all([
      (this.prisma as any).biRecruitsResponse.findMany({
        select: { suggestionComment: true },
      }).catch(() => []),
      (this.prisma as any).activityReport.findMany({
        select: { mainPointsObserved: true, attentionPoints: true, conclusion: true },
      }).catch(() => []),
      (this.prisma as any).biBestPracticeCycleResponse.findMany({
        select: { interactionDifferenceComment: true },
      }).catch(() => []),
      (this.prisma as any).cpcComplaintComment.findMany({
        select: { text: true },
      }).catch(() => []),
    ]);

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

    const allTexts = [
      ...suggestionTexts,
      ...reportObservations,
      ...reportAttention,
      ...reportConclusions,
      ...bestPracticeComments,
      ...cpcaCommentTexts,
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
      },
      consolidated: {
        totalTexts: allTexts.length,
        topWords: tokenizeAndCount(allTexts).slice(0, 80),
        rawTexts: allTexts.slice(0, 1000),
      },
    };
  }

  async aiSourceReferences(type: AiAnalysisType): Promise<AiSourceReference[]> {
    const refs: AiSourceReference[] = [];
    const seen = new Set<string>();

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
      type === 'text';

    if (includePanels) {
      pushRef(
        'bi-survey-dashboard',
        'Pesquisa institucional (BI Survey)',
        '/dashboard/bi',
      );
      pushRef(
        'bi-domestic-dashboard',
        'Pesquisa de violência doméstica',
        '/dashboard/bi-violencia-domestica',
      );
      pushRef(
        'bi-recruits-dashboard',
        'Pesquisa de recrutas',
        '/dashboard/bi-recrutas',
      );
    }

    if (type === 'executive' || type === 'situational' || type === 'text') {
      const latestRecruitBatch = await (this.prisma as any).biRecruitsImportBatch
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

    if (type === 'executive' || type === 'situational' || type === 'text') {
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
        const activityId = String(report?.activityId ?? report?.activity?.id ?? '').trim();
        if (!activityId) continue;
        const scope = String(report?.activity?.scope ?? 'SMIF').toUpperCase();
        const href =
          scope === 'CIPAVD'
            ? `/activities-cipavd?activityId=${encodeURIComponent(activityId)}&tab=report`
            : `/activities?activityId=${encodeURIComponent(activityId)}&tab=report`;
        const title = String(report?.activity?.title ?? '').trim() || `Atividade ${activityId}`;
        const refDate = fmtDate(report?.signedAt ?? report?.updatedAt);
        pushRef(
          `activity-report-${report?.id ?? activityId}`,
          `Relatório de atividade: ${title}`,
          href,
          refDate ? `Última atualização em ${refDate}` : undefined,
        );
      }
    }

    if (type === 'executive' || type === 'situational' || type === 'geo') {
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
        const scope = String(mission?.scope ?? 'SMIF').toUpperCase() === 'CIPAVD' ? 'CIPAVD' : 'SMIF';
        const href = `/missions?missionId=${encodeURIComponent(missionId)}&scope=${scope}`;
        const title = String(mission?.title ?? '').trim() || `Missão ${missionId}`;
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

    if (type === 'executive' || type === 'aggressor' || type === 'situational') {
      const recentCases = await (this.prisma as any).cpcComplaintCase
        .findMany({
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

    pushRef(
      'strategic-dashboard',
      'Painel estratégico consolidado',
      '/dashboard/estrategico',
    );

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

    const payload = {
      situationalDashboard: dashboard,
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
        narrative: content,
        model,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new ServiceUnavailableException(`Falha ao gerar narrativa via LiteLLM: ${msg}`);
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

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
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
        doc.fontSize(12).fillColor('#FFFFFF').text(`${num}  ${title}`, LEFT + 10, y + 7, { width: PAGE_W - 20 });
        doc.y = y + 32;
      };

      const kpiBox = (x: number, y: number, w: number, h: number, value: string, label: string, color: string) => {
        doc.roundedRect(x, y, w, h, 4).fill(BG_LIGHT);
        doc.roundedRect(x, y, 4, h, 2).fill(color);
        doc.fontSize(18).fillColor(color).text(value, x + 12, y + 8, { width: w - 20, align: 'center' });
        doc.fontSize(7).fillColor(GRAY).text(label, x + 8, y + 30, { width: w - 16, align: 'center' });
        return y + h + 6;
      };

      const progressBar = (x: number, y: number, w: number, pct: number, color: string, label: string, valueText: string) => {
        doc.fontSize(8).fillColor(DARK).text(label, x, y, { width: w * 0.55 });
        const barX = x + w * 0.55;
        const barW = w * 0.35;
        const barH = 8;
        doc.roundedRect(barX, y + 1, barW, barH, 3).fill('#E0E0E0');
        const fillW = Math.max(2, (pct / 100) * barW);
        doc.roundedRect(barX, y + 1, fillW, barH, 3).fill(color);
        doc.fontSize(8).fillColor(color).text(valueText, barX + barW + 4, y, { width: 50 });
        return y + 16;
      };

      const rankingRow = (x: number, y: number, w: number, rank: number, label: string, count: number, pct: number, color: string, maxCount: number) => {
        doc.fontSize(8).fillColor(GRAY).text(`${rank}.`, x, y, { width: 14 });
        doc.fontSize(8).fillColor(DARK).text(label, x + 14, y, { width: w * 0.45 });
        const barX = x + w * 0.52;
        const barW = w * 0.35;
        const barH = 7;
        doc.roundedRect(barX, y + 1, barW, barH, 3).fill('#E8EAF0');
        const fillW = Math.max(2, maxCount > 0 ? (count / maxCount) * barW : 0);
        doc.roundedRect(barX, y + 1, fillW, barH, 3).fill(color);
        doc.fontSize(7).fillColor(DARK).text(`${count} (${pct}%)`, barX + barW + 4, y, { width: 55 });
        return y + 14;
      };

      // ======================== COVER PAGE ========================
      drawHeaderBar(0);
      doc.fontSize(24).fillColor('#FFFFFF').text('RELATÓRIO EXECUTIVO', LEFT + 10, 18, { width: PAGE_W - 20, align: 'center' });
      doc.fontSize(11).fillColor('#B0C4DE').text('CIPAVD / SMIF — Prevenção e Combate ao Assédio e Violência Doméstica', LEFT, 46, { width: PAGE_W, align: 'center' });

      doc.y = 90;
      doc.fontSize(9).fillColor(GRAY).text(
        `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
        { align: 'right' },
      );
      doc.moveDown(0.8);

      // ======================== 1. INDICADORES-CHAVE ========================
      sectionHeader('01', 'INDICADORES-CHAVE DE DESEMPENHO');
      doc.moveDown(0.3);

      let ky = doc.y;
      const kw = (PAGE_W - 18) / 4;
      kpiBox(LEFT, ky, kw, 44, String(dashboard.activities.totalActivities), 'Atividades de Campo', BLUE);
      kpiBox(LEFT + kw + 6, ky, kw, 44, String(dashboard.missions.totalMissions), 'Missões Realizadas', GREEN);
      kpiBox(LEFT + (kw + 6) * 2, ky, kw, 44, String(dashboard.complaints.totalCases), 'Denúncias Registradas', RED);
      kpiBox(LEFT + (kw + 6) * 3, ky, kw, 44, String(dashboard.complaints.openCases), 'Casos em Aberto', ORANGE);
      doc.y = ky + 56;

      ky = doc.y;
      kpiBox(LEFT, ky, kw, 44, String(dashboard.surveys.totalResponses), 'Pesquisas (Escolas)', BLUE_LIGHT);
      kpiBox(LEFT + kw + 6, ky, kw, 44, String(dashboard.domesticViolence.totalResponses ?? 0), 'Pesq. Violência Domést.', RED);
      kpiBox(LEFT + (kw + 6) * 2, ky, kw, 44, String(dashboard.recruits.totalResponses ?? 0), 'Pesq. Recrutas', GREEN);
      kpiBox(LEFT + (kw + 6) * 3, ky, kw, 44, String(geoData.totalLocalitiesWithUf ?? 0) + '/' + String(geoData.totalLocalities ?? 0), 'Localidades c/ UF', GRAY);
      doc.y = ky + 56;

      // ======================== 2. TAXAS E INDICADORES ========================
      sectionHeader('02', 'TAXAS E INDICADORES PERCENTUAIS');
      doc.moveDown(0.3);

      let py = doc.y;
      const pw = PAGE_W;
      py = progressBar(LEFT, py, pw, dashboard.surveys.violenceRatePercent, RED, 'Taxa de violência relatada (Escolas)', `${dashboard.surveys.violenceRatePercent}%`);
      py = progressBar(LEFT, py, pw, dashboard.domesticViolence.lifetimeRatePercent, RED, 'Violência doméstica (na vida)', `${dashboard.domesticViolence.lifetimeRatePercent}%`);
      py = progressBar(LEFT, py, pw, dashboard.domesticViolence.last12MonthsRatePercent, ORANGE, 'Violência doméstica (últimos 12 meses)', `${dashboard.domesticViolence.last12MonthsRatePercent}%`);
      py = progressBar(LEFT, py, pw, dashboard.recruits.safeToReportPercent, GREEN, 'Recrutas — Segurança para denunciar', `${dashboard.recruits.safeToReportPercent}%`);
      py = progressBar(LEFT, py, pw, dashboard.recruits.knowReportProcessPercent ?? 0, BLUE, 'Recrutas — Conhece processo de denúncia', `${dashboard.recruits.knowReportProcessPercent ?? 0}%`);
      if (dashboard.domesticViolence.soughtHelpPercent) {
        py = progressBar(LEFT, py, pw, dashboard.domesticViolence.soughtHelpPercent, GREEN, 'Vítimas que buscaram ajuda', `${dashboard.domesticViolence.soughtHelpPercent}%`);
      }
      doc.y = py + 4;

      // ======================== 3. ATIVIDADES E MISSÕES ========================
      ensureSpace(90);
      sectionHeader('03', 'DISTRIBUIÇÃO DE ATIVIDADES E MISSÕES');
      doc.moveDown(0.3);

      const halfW = (PAGE_W - 12) / 2;
      const actY = doc.y;

      doc.roundedRect(LEFT, actY, halfW, 70, 4).fill(BG_LIGHT);
      doc.fontSize(9).fillColor(BLUE).text('ATIVIDADES DE CAMPO', LEFT + 8, actY + 6, { width: halfW - 16 });
      doc.fontSize(8).fillColor(DARK)
        .text(`Total: ${dashboard.activities.totalActivities}`, LEFT + 8, actY + 20)
        .text(`SMIF: ${dashboard.activities.smif}  |  CIPAVD: ${dashboard.activities.cipavd}`, LEFT + 8, actY + 32)
        .text(`Concluídas: ${dashboard.activities.done}  |  Relatórios: ${dashboard.activities.withReport}`, LEFT + 8, actY + 44)
        .text(`Relatórios assinados: ${dashboard.activities.signed}`, LEFT + 8, actY + 56);

      doc.roundedRect(LEFT + halfW + 12, actY, halfW, 70, 4).fill(BG_LIGHT);
      doc.fontSize(9).fillColor(GREEN).text('MISSÕES', LEFT + halfW + 20, actY + 6, { width: halfW - 16 });
      doc.fontSize(8).fillColor(DARK)
        .text(`Total: ${dashboard.missions.totalMissions}`, LEFT + halfW + 20, actY + 20)
        .text(`SMIF: ${dashboard.missions.smif}  |  CIPAVD: ${dashboard.missions.cipavd}`, LEFT + halfW + 20, actY + 32)
        .text(`Localidades cobertas: ${dashboard.missions.localitiesCovered}`, LEFT + halfW + 20, actY + 44);

      doc.y = actY + 82;

      // ======================== 4. DENÚNCIAS ========================
      ensureSpace(100);
      sectionHeader('04', 'PANORAMA DE DENÚNCIAS');
      doc.moveDown(0.3);

      const compY = doc.y;
      const thirdW = (PAGE_W - 12) / 3;

      doc.roundedRect(LEFT, compY, thirdW, 50, 4).fill(BG_LIGHT);
      doc.roundedRect(LEFT, compY, 4, 50, 2).fill(RED);
      doc.fontSize(20).fillColor(RED).text(String(dashboard.complaints.totalCases), LEFT + 12, compY + 6, { width: thirdW - 20, align: 'center' });
      doc.fontSize(7).fillColor(GRAY).text('Total de denúncias', LEFT + 8, compY + 32, { width: thirdW - 16, align: 'center' });

      doc.roundedRect(LEFT + thirdW + 6, compY, thirdW, 50, 4).fill(BG_LIGHT);
      doc.roundedRect(LEFT + thirdW + 6, compY, 4, 50, 2).fill(ORANGE);
      doc.fontSize(20).fillColor(ORANGE).text(String(dashboard.complaints.openCases), LEFT + thirdW + 18, compY + 6, { width: thirdW - 20, align: 'center' });
      doc.fontSize(7).fillColor(GRAY).text('Casos em aberto', LEFT + thirdW + 12, compY + 32, { width: thirdW - 16, align: 'center' });

      doc.roundedRect(LEFT + (thirdW + 6) * 2, compY, thirdW, 50, 4).fill(BG_LIGHT);
      doc.roundedRect(LEFT + (thirdW + 6) * 2, compY, 4, 50, 2).fill(GREEN);
      doc.fontSize(20).fillColor(GREEN).text(String(dashboard.complaints.concludedCases), LEFT + (thirdW + 6) * 2 + 12, compY + 6, { width: thirdW - 20, align: 'center' });
      doc.fontSize(7).fillColor(GRAY).text('Concluídos', LEFT + (thirdW + 6) * 2 + 8, compY + 32, { width: thirdW - 16, align: 'center' });

      doc.y = compY + 58;

      if (dashboard.complaints.totalCases > 0) {
        let dy = doc.y;
        dy = progressBar(LEFT, dy, PAGE_W, dashboard.complaints.moralPercent ?? 0, ORANGE, `Assédio Moral (${dashboard.complaints.moral ?? 0})`, `${dashboard.complaints.moralPercent ?? 0}%`);
        dy = progressBar(LEFT, dy, PAGE_W, dashboard.complaints.sexualPercent ?? 0, RED, `Assédio Sexual (${dashboard.complaints.sexual ?? 0})`, `${dashboard.complaints.sexualPercent ?? 0}%`);
        const cpcaPct = dashboard.complaints.totalCases > 0 ? pct(dashboard.complaints.byCpca ?? 0, dashboard.complaints.totalCases) : 0;
        const smifPct = dashboard.complaints.totalCases > 0 ? pct(dashboard.complaints.bySmif ?? 0, dashboard.complaints.totalCases) : 0;
        dy = progressBar(LEFT, dy, PAGE_W, cpcaPct, BLUE, `Escopo CPCA (${dashboard.complaints.byCpca ?? 0})`, `${cpcaPct}%`);
        dy = progressBar(LEFT, dy, PAGE_W, smifPct, BLUE_LIGHT, `Escopo SMIF (${dashboard.complaints.bySmif ?? 0})`, `${smifPct}%`);
        doc.y = dy + 4;
      }

      // ======================== 5. PERFIL DO AGRESSOR ========================
      if (profile.totalCases > 0) {
        doc.addPage();
        sectionHeader('05', 'PERFIL DE ASSÉDIO E VIOLÊNCIA');
        doc.moveDown(0.3);

        const profHalfW = (PAGE_W - 12) / 2;

        if (profile.aggressorProfile?.byRank?.length > 0) {
          const startY = doc.y;
          doc.roundedRect(LEFT, startY, profHalfW, 10, 0).fill(BLUE);
          doc.fontSize(8).fillColor('#FFFFFF').text('RANKING — Postos/Graduações do Agressor', LEFT + 6, startY + 2, { width: profHalfW - 12 });
          let ry = startY + 16;
          const maxC = profile.aggressorProfile.byRank[0]?.count ?? 1;
          for (const [i, item] of profile.aggressorProfile.byRank.slice(0, 8).entries()) {
            ry = rankingRow(LEFT, ry, profHalfW, i + 1, item.label, item.count, item.percent, BLUE, maxC);
          }
          doc.y = Math.max(doc.y, ry);
        }

        if (profile.victimProfile?.byRank?.length > 0) {
          const startY2 = profile.aggressorProfile?.byRank?.length > 0 ? doc.y - ((profile.aggressorProfile.byRank.slice(0, 8).length) * 14 + 16) : doc.y;
          const vx = LEFT + profHalfW + 12;
          doc.roundedRect(vx, startY2, profHalfW, 10, 0).fill(RED);
          doc.fontSize(8).fillColor('#FFFFFF').text('RANKING — Postos/Graduações da Vítima', vx + 6, startY2 + 2, { width: profHalfW - 12 });
          let vy = startY2 + 16;
          const maxV = profile.victimProfile.byRank[0]?.count ?? 1;
          for (const [i, item] of profile.victimProfile.byRank.slice(0, 8).entries()) {
            vy = rankingRow(vx, vy, profHalfW, i + 1, item.label, item.count, item.percent, RED, maxV);
          }
          doc.y = Math.max(doc.y, vy);
        }

        doc.moveDown(0.5);

        if (profile.context?.byViolenceType?.length > 0) {
          ensureSpace(80);
          doc.roundedRect(LEFT, doc.y, PAGE_W, 10, 0).fill(ORANGE);
          doc.fontSize(8).fillColor('#FFFFFF').text('TIPOS DE VIOLÊNCIA MAIS FREQUENTES', LEFT + 6, doc.y + 2, { width: PAGE_W - 12 });
          let ty = doc.y + 16;
          const maxT = profile.context.byViolenceType[0]?.count ?? 1;
          for (const [i, item] of profile.context.byViolenceType.slice(0, 8).entries()) {
            ty = rankingRow(LEFT, ty, PAGE_W, i + 1, item.label, item.count, item.percent, ORANGE, maxT);
          }
          doc.y = ty + 4;
        }

        ensureSpace(50);
        doc.moveDown(0.3);
        doc.roundedRect(LEFT, doc.y, PAGE_W, 40, 4).fill(BG_LIGHT);
        const insY = doc.y;
        doc.fontSize(8).fillColor(BLUE).text('INSIGHT', LEFT + 8, insY + 6, { width: 40 });
        const hierPct = profile.hierarchicalRelation?.percent ?? 0;
        const hierCount = profile.hierarchicalRelation?.count ?? 0;
        doc.fontSize(8).fillColor(DARK).text(
          `${hierPct}% dos casos (${hierCount}) envolvem relação hierárquica superior-subordinado. ` +
          `O tipo predominante é Assédio ${(profile.byComplaintType?.moral?.percent ?? 0) > (profile.byComplaintType?.sexual?.percent ?? 0) ? 'Moral' : 'Sexual'} ` +
          `(${Math.max(profile.byComplaintType?.moral?.percent ?? 0, profile.byComplaintType?.sexual?.percent ?? 0)}%).`,
          LEFT + 52, insY + 6, { width: PAGE_W - 68 },
        );
        doc.y = insY + 48;
      }

      // ======================== 6. ANÁLISE DE TEXTO ========================
      ensureSpace(100);
      sectionHeader('06', 'ANÁLISE DE TEXTO — TERMOS MAIS CITADOS');
      doc.moveDown(0.3);

      const topWords = textData.consolidated.topWords.slice(0, 25);
      if (topWords.length > 0) {
        doc.fontSize(8).fillColor(GRAY).text(`${textData.consolidated.totalTexts} textos livres analisados de relatórios, sugestões e comentários.`);
        doc.moveDown(0.4);

        const maxWordCount = topWords[0]?.count ?? 1;
        const wordBoxW = PAGE_W;
        let wy = doc.y;
        for (const w of topWords.slice(0, 15)) {
          const barPct = w.count / maxWordCount;
          const barW = Math.max(4, barPct * (wordBoxW * 0.5));
          doc.fontSize(8).fillColor(DARK).text(w.word, LEFT, wy, { width: wordBoxW * 0.25 });
          doc.roundedRect(LEFT + wordBoxW * 0.25, wy + 1, wordBoxW * 0.5, 8, 3).fill('#E8EAF0');
          const barColor = barPct > 0.7 ? BLUE : barPct > 0.4 ? BLUE_LIGHT : '#7BA0D4';
          doc.roundedRect(LEFT + wordBoxW * 0.25, wy + 1, barW, 8, 3).fill(barColor);
          doc.fontSize(7).fillColor(GRAY).text(String(w.count), LEFT + wordBoxW * 0.78, wy, { width: 40 });
          wy += 13;
          if (wy > 760) { doc.addPage(); wy = doc.y; }
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
            if (idx > 0 && idx % 3 === 0) { sx = LEFT; sy += 55; ensureSpace(55); }
            const lbl = sourceLabels[src.key] ?? src.key;
            doc.roundedRect(sx, sy, srcColW - 6, 50, 4).fill(BG_LIGHT);
            doc.fontSize(7).fillColor(BLUE).text(lbl, sx + 6, sy + 4, { width: srcColW - 18 });
            doc.fontSize(14).fillColor(DARK).text(String(src.count), sx + 6, sy + 16, { width: srcColW - 18 });
            doc.fontSize(6).fillColor(GRAY).text(
              src.topWords.slice(0, 5).map((w2: any) => w2.word).join(', '),
              sx + 6, sy + 34, { width: srcColW - 18 },
            );
            sx += srcColW;
          }
          doc.y = sy + 58;
        }
      } else {
        doc.fontSize(9).fillColor(GRAY).text('Nenhum texto disponível para análise.');
      }

      // ======================== 7. MAPA GEOGRÁFICO ========================
      const statesWithData = (geoData.states ?? []).filter((s: any) => s.complaints + s.activities + s.missions > 0);
      if (statesWithData.length > 0) {
        ensureSpace(120);
        sectionHeader('07', 'DISTRIBUIÇÃO GEOGRÁFICA');
        doc.moveDown(0.3);

        doc.fontSize(8).fillColor(GRAY).text(
          `${statesWithData.length} estado(s) com registros de ${geoData.totalLocalitiesWithUf} localidades com UF preenchida.`,
        );
        doc.moveDown(0.3);

        // Table header
        const cols = [40, 60, 60, 60, 50, PAGE_W - 270];
        const headers = ['UF', 'Denúncias', 'Atividades', 'Missões', 'Total', 'Localidades'];
        let tx = LEFT;
        const thY = doc.y;
        doc.rect(LEFT, thY, PAGE_W, 14).fill(BLUE);
        for (const [ci, hdr] of headers.entries()) {
          doc.fontSize(7).fillColor('#FFFFFF').text(hdr, tx + 3, thY + 3, { width: cols[ci] - 6 });
          tx += cols[ci];
        }
        doc.y = thY + 16;

        for (const [ri, s] of statesWithData.slice(0, 15).entries()) {
          ensureSpace(14);
          const rowY = doc.y;
          if (ri % 2 === 0) doc.rect(LEFT, rowY, PAGE_W, 13).fill(BG_LIGHT);
          let rx = LEFT;
          const total = s.complaints + s.activities + s.missions;
          const vals = [s.uf, String(s.complaints), String(s.activities), String(s.missions), String(total), (s.localities ?? []).slice(0, 4).join(', ')];
          for (const [ci, val] of vals.entries()) {
            doc.fontSize(7).fillColor(DARK).text(val, rx + 3, rowY + 3, { width: cols[ci] - 6 });
            rx += cols[ci];
          }
          doc.y = rowY + 14;
        }
        if (statesWithData.length > 15) {
          doc.fontSize(7).fillColor(GRAY).text(`... e mais ${statesWithData.length - 15} estado(s).`);
        }
      }

      // ======================== FOOTER ========================
      doc.moveDown(1.5);
      ensureSpace(30);
      doc.moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).strokeColor('#E0E0E0').lineWidth(0.5).stroke();
      doc.moveDown(0.3);
      doc.fontSize(7).fillColor(GRAY).text(
        'DOCUMENTO CLASSIFICADO — USO INTERNO  |  Sistema de Gestão CIPAVD/SMIF  |  Força Aérea Brasileira',
        { align: 'center' },
      );
      doc.fontSize(6).fillColor('#999999').text(
        `Gerado automaticamente em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}. Dados sujeitos a atualização.`,
        { align: 'center' },
      );

      doc.end();
    });
  }

  private async getSurveyKpis() {
    try {
      const model = (this.prisma as any).biSurveyResponse;
      const total = await model.count();
      if (total === 0) return { totalResponses: 0, violenceRatePercent: 0, yesCount: 0, noCount: 0 };
      const yesCount = await model.count({ where: { sufferedViolence: true } });
      return {
        totalResponses: total,
        yesCount,
        noCount: total - yesCount,
        violenceRatePercent: pct(yesCount, total),
      };
    } catch {
      return { totalResponses: 0, violenceRatePercent: 0, yesCount: 0, noCount: 0 };
    }
  }

  private async getDomesticViolenceKpis() {
    try {
      const model = (this.prisma as any).biDomesticViolenceResponse;
      const total = await model.count();
      if (total === 0) return { totalResponses: 0, lifetimeRatePercent: 0, last12MonthsRatePercent: 0, soughtHelpPercent: 0 };
      const lifetimeYes = await model.count({ where: { sufferedLifetime: true } });
      const last12Yes = await model.count({ where: { sufferedLast12Months: true } });
      const soughtHelp = await model.count({ where: { soughtHelp: true } });
      return {
        totalResponses: total,
        lifetimeYes,
        lifetimeRatePercent: pct(lifetimeYes, total),
        last12MonthsYes: last12Yes,
        last12MonthsRatePercent: pct(last12Yes, total),
        soughtHelp,
        soughtHelpPercent: pct(soughtHelp, lifetimeYes > 0 ? lifetimeYes : total),
      };
    } catch {
      return { totalResponses: 0, lifetimeRatePercent: 0, last12MonthsRatePercent: 0, soughtHelpPercent: 0 };
    }
  }

  private async getRecruitsKpis() {
    try {
      const model = (this.prisma as any).biRecruitsResponse;
      const total = await model.count();
      if (total === 0) return { totalResponses: 0, safeToReportPercent: 0, knowReportProcessPercent: 0 };
      const all = await model.findMany({
        select: { willingnessReport: true, knowReportProcess: true },
      });
      const safeCount = all.filter((r: any) => r.willingnessReport === 'Seguro(a)').length;
      const knowProcess = all.filter((r: any) => r.knowReportProcess === 'Sim').length;
      return {
        totalResponses: total,
        safeCount,
        safeToReportPercent: pct(safeCount, total),
        knowProcess,
        knowReportProcessPercent: pct(knowProcess, total),
      };
    } catch {
      return { totalResponses: 0, safeToReportPercent: 0, knowReportProcessPercent: 0 };
    }
  }

  private async getComplaintsKpis() {
    try {
      const model = (this.prisma as any).cpcComplaintCase;
      const total = await model.count();
      const openStatuses = ['RECEIVED', 'PROTECTION_MEASURES', 'PRELIMINARY_ANALYSIS', 'PROCEDURE_DEFINED', 'INVESTIGATION'];
      const openCases = await model.count({ where: { status: { in: openStatuses } } });
      const byCpca = await model.count({ where: { workflowScope: 'CPCA' } });
      const bySmif = await model.count({ where: { workflowScope: 'SMIF' } });
      const moral = await model.count({ where: { complaintType: 'MORAL' } });
      const sexual = await model.count({ where: { complaintType: 'SEXUAL' } });
      return {
        totalCases: total,
        openCases,
        concludedCases: total - openCases,
        byCpca,
        bySmif,
        moral,
        sexual,
        moralPercent: pct(moral, total),
        sexualPercent: pct(sexual, total),
      };
    } catch {
      return { totalCases: 0, openCases: 0, concludedCases: 0, byCpca: 0, bySmif: 0, moral: 0, sexual: 0, moralPercent: 0, sexualPercent: 0 };
    }
  }

  private async getActivitiesKpis() {
    try {
      const total = await this.prisma.activity.count();
      const done = await this.prisma.activity.count({ where: { status: 'DONE' } });
      const smif = await this.prisma.activity.count({ where: { scope: 'SMIF' } });
      const cipavd = await this.prisma.activity.count({ where: { scope: 'CIPAVD' } });
      const withReport = await (this.prisma as any).activityReport.count();
      const signed = await (this.prisma as any).activityReport.count({ where: { signedAt: { not: null } } });
      return { totalActivities: total, done, smif, cipavd, withReport, signed };
    } catch {
      return { totalActivities: 0, done: 0, smif: 0, cipavd: 0, withReport: 0, signed: 0 };
    }
  }

  private async getMissionsKpis() {
    try {
      const model = (this.prisma as any).mission;
      const total = await model.count();
      const smif = await model.count({ where: { scope: 'SMIF' } });
      const cipavd = await model.count({ where: { scope: 'CIPAVD' } });
      const distinctLocalities = await model.findMany({ select: { localityId: true }, distinct: ['localityId'] });
      return {
        totalMissions: total,
        smif,
        cipavd,
        localitiesCovered: distinctLocalities.length,
      };
    } catch {
      return { totalMissions: 0, smif: 0, cipavd: 0, localitiesCovered: 0 };
    }
  }
}
