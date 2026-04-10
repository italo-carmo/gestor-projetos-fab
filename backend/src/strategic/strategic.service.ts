import { Injectable } from '@nestjs/common';
import { LocalityCatalogType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { selectTargetLocalities } from '../common/priority-localities';
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

@Injectable()
export class StrategicService {
  constructor(private readonly prisma: PrismaService) {}

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
        select: { suggestionComment: true, enlistmentDecisionInfluenceText: true },
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

    const suggestionTexts = recruitsResponses
      .map((r: any) => r.suggestionComment)
      .filter(Boolean);
    const enlistmentTexts = recruitsResponses
      .map((r: any) => r.enlistmentDecisionInfluenceText)
      .filter(Boolean);
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
      ...enlistmentTexts,
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
        recruitsEnlistment: buildSource(enlistmentTexts),
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

  async executiveReportPdf(): Promise<Buffer> {
    const [dashboard, profileRaw, textData] = await Promise.all([
      this.situationalDashboard(),
      this.aggressorProfile(),
      this.textAnalysis(),
    ]);
    const profile = profileRaw as any;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const blue = '#1A3C6E';
      const gray = '#666666';
      const lightBg = '#F5F7FA';

      doc.fontSize(22).fillColor(blue).text('Relatório Executivo Estratégico', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(12).fillColor(gray).text(
        'CIPAVD / SMIF — Prevenção e Combate ao Assédio e Violência Doméstica',
        { align: 'center' },
      );
      doc.moveDown(0.2);
      doc.fontSize(10).text(
        `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
        { align: 'center' },
      );
      doc.moveDown(1);

      const drawLine = () => {
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#E0E0E0').stroke();
        doc.moveDown(0.5);
      };

      const sectionTitle = (title: string) => {
        doc.moveDown(0.5);
        doc.fontSize(14).fillColor(blue).text(title);
        drawLine();
      };

      const kpiRow = (label: string, value: string | number) => {
        doc.fontSize(10).fillColor('#333333').text(`${label}: `, { continued: true });
        doc.fillColor(blue).text(String(value));
      };

      sectionTitle('1. Painel Situacional');
      kpiRow('Pesquisas (Escolas) — Respostas', dashboard.surveys.totalResponses);
      kpiRow('Taxa de violência relatada', `${dashboard.surveys.violenceRatePercent}%`);
      kpiRow('Violência Doméstica — Taxa na vida', `${dashboard.domesticViolence.lifetimeRatePercent}%`);
      kpiRow('Violência Doméstica — Últimos 12 meses', `${dashboard.domesticViolence.last12MonthsRatePercent}%`);
      kpiRow('Recrutas — Sensação de segurança', `${dashboard.recruits.safeToReportPercent}%`);
      kpiRow('Denúncias ativas (CPCA + SMIF)', dashboard.complaints.openCases);
      kpiRow('Total de denúncias', dashboard.complaints.totalCases);
      kpiRow('Atividades de campo realizadas', dashboard.activities.totalActivities);
      kpiRow('Missões realizadas', dashboard.missions.totalMissions);

      sectionTitle('2. Perfil de Assédio e Violência');
      kpiRow('Total de casos analisados', profile.totalCases);
      if (profile.totalCases > 0) {
        kpiRow('Assédio Moral', `${profile.byComplaintType.moral.count} (${profile.byComplaintType.moral.percent}%)`);
        kpiRow('Assédio Sexual', `${profile.byComplaintType.sexual.count} (${profile.byComplaintType.sexual.percent}%)`);
        kpiRow('Relação hierárquica (superior)', `${profile.hierarchicalRelation.count} (${profile.hierarchicalRelation.percent}%)`);

        if (profile.aggressorProfile.byRank.length > 0) {
          doc.moveDown(0.3);
          doc.fontSize(10).fillColor(gray).text('Postos/Graduações de agressores mais frequentes:');
          for (const item of profile.aggressorProfile.byRank.slice(0, 5)) {
            doc.fontSize(9).fillColor('#333333').text(`  • ${item.label}: ${item.count} (${item.percent}%)`);
          }
        }
        if (profile.victimProfile?.byRank?.length > 0) {
          doc.moveDown(0.3);
          doc.fontSize(10).fillColor(gray).text('Postos/Graduações de vítimas mais frequentes:');
          for (const item of profile.victimProfile.byRank.slice(0, 5)) {
            doc.fontSize(9).fillColor('#333333').text(`  • ${item.label}: ${item.count} (${item.percent}%)`);
          }
        }
        if (profile.context?.byViolenceType?.length > 0) {
          doc.moveDown(0.3);
          doc.fontSize(10).fillColor(gray).text('Tipos de violência mais frequentes:');
          for (const item of profile.context.byViolenceType.slice(0, 5)) {
            doc.fontSize(9).fillColor('#333333').text(`  • ${item.label}: ${item.count} (${item.percent}%)`);
          }
        }
      }

      sectionTitle('3. Análise de Texto — Termos mais frequentes');
      const topWords = textData.consolidated.topWords.slice(0, 20);
      if (topWords.length > 0) {
        doc.fontSize(10).fillColor(gray).text(
          `Total de textos analisados: ${textData.consolidated.totalTexts}`,
        );
        doc.moveDown(0.3);
        const wordLines: string[] = [];
        for (let i = 0; i < topWords.length; i += 4) {
          const chunk = topWords.slice(i, i + 4);
          wordLines.push(chunk.map((w: any) => `${w.word} (${w.count})`).join('  |  '));
        }
        for (const line of wordLines) {
          doc.fontSize(9).fillColor('#333333').text(line);
        }
      } else {
        doc.fontSize(10).fillColor(gray).text('Nenhum texto disponível para análise.');
      }

      const sourcesWithData = Object.entries(textData.sources)
        .filter(([, data]: [string, any]) => data.count > 0)
        .map(([key, data]: [string, any]) => ({ key, ...data }));
      if (sourcesWithData.length > 0) {
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor(gray).text('Detalhamento por fonte:');
        const sourceLabels: Record<string, string> = {
          recruitsSuggestions: 'Sugestões dos recrutas',
          recruitsEnlistment: 'Motivos de alistamento',
          reportObservations: 'Observações dos relatórios',
          reportAttentionPoints: 'Pontos de atenção',
          reportConclusions: 'Conclusões dos relatórios',
          bestPracticeComments: 'Comentários Boas Práticas',
          cpcaComments: 'Comentários CPCA',
        };
        for (const src of sourcesWithData) {
          const label = sourceLabels[src.key] ?? src.key;
          doc.fontSize(9).fillColor('#333333').text(
            `  ${label} (${src.count} textos): ${src.topWords.slice(0, 8).map((w: any) => w.word).join(', ')}`,
          );
        }
      }

      doc.moveDown(1);
      drawLine();
      doc.fontSize(8).fillColor(gray).text(
        'Documento gerado automaticamente pelo Sistema de Gestão CIPAVD/SMIF. Classificação: USO INTERNO.',
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
      const smifLocalities = await this.prisma.locality.findMany({
        where: { catalogType: LocalityCatalogType.SMIF },
        select: { id: true, name: true, recruitsFemaleCountCurrent: true, updatedAt: true } as any,
      } as any);
      const smifTargetIds = selectTargetLocalities(smifLocalities).map((l: any) => l.id);

      const total = await this.prisma.activity.count();
      const done = await this.prisma.activity.count({ where: { status: 'DONE' } });
      const smif = await this.prisma.activity.count({
        where: { scope: 'SMIF', localityId: { in: smifTargetIds } },
      });
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
