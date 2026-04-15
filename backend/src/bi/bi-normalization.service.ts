import { Injectable } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { normalizeFabOm } from '../catalog/om-resolver';
import { PrismaService } from '../prisma/prisma.service';

export const BI_NORMALIZATION_SOURCE_TYPES = {
  SURVEY_SCHOOLS: 'SURVEY_SCHOOLS',
  DOMESTIC_VIOLENCE: 'DOMESTIC_VIOLENCE',
  RECRUITS: 'RECRUITS',
  BEST_PRACTICE_CYCLE: 'BEST_PRACTICE_CYCLE',
  CPCA_MEETING: 'CPCA_MEETING',
  GSD_EVALUATION: 'GSD_EVALUATION',
} as const;

export type BiNormalizationSourceTypeValue =
  (typeof BI_NORMALIZATION_SOURCE_TYPES)[keyof typeof BI_NORMALIZATION_SOURCE_TYPES];

export const BI_NORMALIZATION_STATUSES = {
  MATCHED: 'MATCHED',
  UF_ONLY: 'UF_ONLY',
  NOT_FOUND: 'NOT_FOUND',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
} as const;

export type BiNormalizationStatusValue =
  (typeof BI_NORMALIZATION_STATUSES)[keyof typeof BI_NORMALIZATION_STATUSES];

const UF_CODES = new Set([
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC',
  'SP','SE','TO',
]);

type SourceCapability = 'OM_UF' | 'UF_HEURISTIC' | 'NONE';

type SourceConfig = {
  sourceType: BiNormalizationSourceTypeValue;
  label: string;
  description: string;
  capability: SourceCapability;
};

type OmCatalogItem = {
  id: string;
  code: string;
  name: string;
  uf: string | null;
  codeKey: string;
  nameKey: string;
};

type LocalityCatalogItem = {
  id: string;
  code: string;
  name: string;
  uf: string | null;
  codeKey: string;
  nameKey: string;
};

type LinkInput = {
  sourceType: BiNormalizationSourceTypeValue;
  sourceRecordId: string;
  sourceBatchId?: string | null;
  rawReference?: string | null;
  secondaryReference?: string | null;
  omId?: string | null;
  uf?: string | null;
  status: BiNormalizationStatusValue;
  confidence?: number | null;
  resolutionMethod?: string | null;
};

type JsonCandidate = {
  rawReference?: string | null;
  secondaryReference?: string | null;
  directUf?: string | null;
};

const SOURCE_CONFIGS: SourceConfig[] = [
  {
    sourceType: BI_NORMALIZATION_SOURCE_TYPES.SURVEY_SCHOOLS,
    label: 'Pesquisas de escolas',
    description: 'Normalização pelo campo OM da resposta, com resolução para OM e UF.',
    capability: 'OM_UF',
  },
  {
    sourceType: BI_NORMALIZATION_SOURCE_TYPES.DOMESTIC_VIOLENCE,
    label: 'Pesquisa de violência doméstica',
    description: 'Normalização pelo campo organização, com resolução para OM e UF.',
    capability: 'OM_UF',
  },
  {
    sourceType: BI_NORMALIZATION_SOURCE_TYPES.RECRUITS,
    label: 'Pesquisa de recrutas',
    description: 'Fonte sem chave organizacional nativa; fica sinalizada como não aplicável.',
    capability: 'NONE',
  },
  {
    sourceType: BI_NORMALIZATION_SOURCE_TYPES.BEST_PRACTICE_CYCLE,
    label: 'Pesquisa ciclo de boas práticas',
    description: 'Heurística sobre campos de identificação para inferir OM e UF quando presentes.',
    capability: 'UF_HEURISTIC',
  },
  {
    sourceType: BI_NORMALIZATION_SOURCE_TYPES.CPCA_MEETING,
    label: 'Pesquisa encontro CPCA',
    description: 'Heurística sobre respostas livres para detectar OM, localidade ou UF.',
    capability: 'UF_HEURISTIC',
  },
  {
    sourceType: BI_NORMALIZATION_SOURCE_TYPES.GSD_EVALUATION,
    label: 'Pesquisa avaliação GSD',
    description: 'Heurística sobre respostas livres para detectar OM, localidade ou UF.',
    capability: 'UF_HEURISTIC',
  },
];

function normalizeKey(value: string | null | undefined) {
  return normalizeFabOm(value).replace(/[^A-Z0-9]/g, '');
}

function normalizeDisplayText(value: string | null | undefined) {
  return String(value ?? '').trim();
}

function normalizeUfCode(value: string | null | undefined) {
  const raw = normalizeFabOm(value);
  if (UF_CODES.has(raw)) return raw;
  return null;
}

function computeOmScore(
  rowCode: string,
  rowName: string,
  candidateKey: string,
) {
  let score = -1;
  if (rowCode && rowCode === candidateKey) {
    score = Math.max(score, 1400 + rowCode.length);
  }
  if (rowCode && rowCode.length >= 3 && candidateKey.includes(rowCode)) {
    score = Math.max(score, 1300 + rowCode.length);
  }
  if (rowCode && candidateKey.length >= 3 && rowCode.includes(candidateKey)) {
    score = Math.max(score, 1250 + candidateKey.length);
  }
  if (rowName && rowName === candidateKey) {
    score = Math.max(score, 1000 + rowName.length);
  }
  if (rowName && rowName.length >= 5 && candidateKey.includes(rowName)) {
    score = Math.max(score, 950 + rowName.length);
  }
  if (
    rowCode &&
    candidateKey &&
    rowCode.length >= 4 &&
    candidateKey.length >= 4 &&
    (rowCode.endsWith(candidateKey) || candidateKey.endsWith(rowCode))
  ) {
    score = Math.max(score, 900 + Math.min(rowCode.length, candidateKey.length));
  }
  return score;
}

function computeLocalityScore(
  rowCode: string,
  rowName: string,
  candidateKey: string,
) {
  let score = -1;
  if (rowCode && rowCode === candidateKey) {
    score = Math.max(score, 1200 + rowCode.length);
  }
  if (rowName && rowName === candidateKey) {
    score = Math.max(score, 1000 + rowName.length);
  }
  if (rowName && rowName.length >= 4 && candidateKey.includes(rowName)) {
    score = Math.max(score, 920 + rowName.length);
  }
  if (
    rowCode &&
    candidateKey &&
    rowCode.length >= 2 &&
    candidateKey.length >= 2 &&
    candidateKey.includes(rowCode)
  ) {
    score = Math.max(score, 850 + rowCode.length);
  }
  return score;
}

@Injectable()
export class BiNormalizationService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [sourceSummaries, latestUpdate] = await Promise.all([
      Promise.all(SOURCE_CONFIGS.map((config) => this.buildSourceSummary(config))),
      this.prisma.biNormalizationLink.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
    ]);

    const totals = sourceSummaries.reduce(
      (
        acc: {
          totalRecords: number;
          matched: number;
          ufOnly: number;
          notFound: number;
          notApplicable: number;
          supportedRecords: number;
          supportedResolved: number;
        },
        item: any,
      ) => {
        acc.totalRecords += item.totalRecords;
        acc.matched += item.statusCounts.matched;
        acc.ufOnly += item.statusCounts.ufOnly;
        acc.notFound += item.statusCounts.notFound;
        acc.notApplicable += item.statusCounts.notApplicable;
        acc.supportedRecords += item.supported ? item.totalRecords : 0;
        acc.supportedResolved += item.supported
          ? item.statusCounts.matched + item.statusCounts.ufOnly
          : 0;
        return acc;
      },
      {
        totalRecords: 0,
        matched: 0,
        ufOnly: 0,
        notFound: 0,
        notApplicable: 0,
        supportedRecords: 0,
        supportedResolved: 0,
      },
    );

    return {
      generatedAt: new Date().toISOString(),
      lastUpdatedAt: latestUpdate?.updatedAt?.toISOString?.() ?? null,
      overall: {
        totalRecords: totals.totalRecords,
        matched: totals.matched,
        ufOnly: totals.ufOnly,
        notFound: totals.notFound,
        notApplicable: totals.notApplicable,
        supportedCoveragePercent:
          totals.supportedRecords > 0
            ? Number(
                (
                  ((totals.supportedResolved / totals.supportedRecords) * 100) ||
                  0
                ).toFixed(1),
              )
            : 0,
      },
      sources: sourceSummaries,
    };
  }

  async rebuild(params?: { sourceType?: BiNormalizationSourceTypeValue | string | null }) {
    const requestedType = String(params?.sourceType ?? '').trim();
    const targets = requestedType
      ? SOURCE_CONFIGS.filter((config) => config.sourceType === requestedType)
      : SOURCE_CONFIGS;

    if (targets.length === 0) {
      return {
        processed: [],
        generatedAt: new Date().toISOString(),
      };
    }

    const results = [] as Array<{
      sourceType: BiNormalizationSourceTypeValue;
      label: string;
      totalProcessed: number;
      matched: number;
      ufOnly: number;
      notFound: number;
      notApplicable: number;
    }>;

    for (const config of targets) {
      results.push(await this.rebuildSource(config));
    }

    return {
      generatedAt: new Date().toISOString(),
      processed: results,
    };
  }

  private async buildSourceSummary(config: SourceConfig) {
    const totalRecords = await this.countSourceRecords(config.sourceType);
    const links = await this.prisma.biNormalizationLink.findMany({
      where: { sourceType: config.sourceType },
      orderBy: [{ updatedAt: 'desc' }],
      select: {
        status: true,
        updatedAt: true,
        rawReference: true,
        secondaryReference: true,
        uf: true,
        om: {
          select: {
            code: true,
            name: true,
            uf: true,
          },
        },
      },
    });

    const statusCounts = {
      matched: 0,
      ufOnly: 0,
      notFound: 0,
      notApplicable: 0,
    };

    for (const link of links) {
      if (link.status === BI_NORMALIZATION_STATUSES.MATCHED) statusCounts.matched += 1;
      else if (link.status === BI_NORMALIZATION_STATUSES.UF_ONLY) statusCounts.ufOnly += 1;
      else if (link.status === BI_NORMALIZATION_STATUSES.NOT_FOUND) statusCounts.notFound += 1;
      else statusCounts.notApplicable += 1;
    }

    if (config.capability === 'NONE') {
      statusCounts.notApplicable = totalRecords;
      statusCounts.matched = 0;
      statusCounts.ufOnly = 0;
      statusCounts.notFound = 0;
    }

    const supported = config.capability !== 'NONE';
    const resolvedCount = statusCounts.matched + statusCounts.ufOnly;
    const coveragePercent = supported
      ? Number((((resolvedCount / Math.max(totalRecords, 1)) * 100) || 0).toFixed(1))
      : null;

    return {
      sourceType: config.sourceType,
      label: config.label,
      description: config.description,
      supported,
      capability: config.capability,
      totalRecords,
      coveragePercent,
      statusCounts,
      latestUpdatedAt: links[0]?.updatedAt?.toISOString?.() ?? null,
      unresolvedSamples: links
        .filter((item: any) => item.status === BI_NORMALIZATION_STATUSES.NOT_FOUND)
        .slice(0, 5)
        .map((item: any) => ({
          rawReference: item.rawReference,
          secondaryReference: item.secondaryReference,
        })),
    };
  }

  private async rebuildSource(config: SourceConfig) {
    const omCatalog = await this.loadOmCatalog();
    const localityCatalog = await this.loadLocalityCatalog();

    let links: LinkInput[] = [];
    switch (config.sourceType) {
      case BI_NORMALIZATION_SOURCE_TYPES.SURVEY_SCHOOLS:
        links = await this.normalizeSurveySchools(omCatalog);
        break;
      case BI_NORMALIZATION_SOURCE_TYPES.DOMESTIC_VIOLENCE:
        links = await this.normalizeDomesticViolence(omCatalog);
        break;
      case BI_NORMALIZATION_SOURCE_TYPES.RECRUITS:
        links = await this.normalizeRecruitsNotApplicable();
        break;
      case BI_NORMALIZATION_SOURCE_TYPES.BEST_PRACTICE_CYCLE:
        links = await this.normalizeBestPracticeCycle(omCatalog, localityCatalog);
        break;
      case BI_NORMALIZATION_SOURCE_TYPES.CPCA_MEETING:
        links = await this.normalizeJsonDrivenSource(
          BI_NORMALIZATION_SOURCE_TYPES.CPCA_MEETING,
          'biCpcaMeetingResponse',
          omCatalog,
          localityCatalog,
        );
        break;
      case BI_NORMALIZATION_SOURCE_TYPES.GSD_EVALUATION:
        links = await this.normalizeJsonDrivenSource(
          BI_NORMALIZATION_SOURCE_TYPES.GSD_EVALUATION,
          'biGsdEvaluationResponse',
          omCatalog,
          localityCatalog,
        );
        break;
      default:
        links = [];
        break;
    }

    await this.persistLinks(config.sourceType, links);

    return {
      sourceType: config.sourceType,
      label: config.label,
      totalProcessed: links.length,
      matched: links.filter((item) => item.status === BI_NORMALIZATION_STATUSES.MATCHED).length,
      ufOnly: links.filter((item) => item.status === BI_NORMALIZATION_STATUSES.UF_ONLY).length,
      notFound: links.filter((item) => item.status === BI_NORMALIZATION_STATUSES.NOT_FOUND).length,
      notApplicable: links.filter((item) => item.status === BI_NORMALIZATION_STATUSES.NOT_APPLICABLE).length,
    };
  }

  private async normalizeSurveySchools(omCatalog: OmCatalogItem[]) {
    const rows = await this.prisma.biSurveyResponse.findMany({
      select: {
        id: true,
        batchId: true,
        om: true,
      },
    });

    return rows.map((row) =>
      this.resolveByOmReference({
        sourceType: BI_NORMALIZATION_SOURCE_TYPES.SURVEY_SCHOOLS,
        sourceRecordId: row.id,
        sourceBatchId: row.batchId,
        rawReference: row.om,
        omCatalog,
        fallbackStatus: BI_NORMALIZATION_STATUSES.NOT_FOUND,
      }),
    );
  }

  private async normalizeDomesticViolence(omCatalog: OmCatalogItem[]) {
    const rows = await this.prisma.biDomesticViolenceResponse.findMany({
      select: {
        id: true,
        batchId: true,
        organization: true,
      },
    });

    return rows.map((row) =>
      this.resolveByOmReference({
        sourceType: BI_NORMALIZATION_SOURCE_TYPES.DOMESTIC_VIOLENCE,
        sourceRecordId: row.id,
        sourceBatchId: row.batchId,
        rawReference: row.organization,
        omCatalog,
        fallbackStatus: BI_NORMALIZATION_STATUSES.NOT_FOUND,
      }),
    );
  }

  private async normalizeRecruitsNotApplicable() {
    const rows = await this.prisma.biRecruitsResponse.findMany({
      select: {
        id: true,
        batchId: true,
      },
    });

    return rows.map((row) => ({
      sourceType: BI_NORMALIZATION_SOURCE_TYPES.RECRUITS,
      sourceRecordId: row.id,
      sourceBatchId: row.batchId,
      status: BI_NORMALIZATION_STATUSES.NOT_APPLICABLE,
      resolutionMethod: 'SOURCE_WITHOUT_ORGANIZATIONAL_KEY',
    }));
  }

  private async normalizeBestPracticeCycle(
    omCatalog: OmCatalogItem[],
    localityCatalog: LocalityCatalogItem[],
  ) {
    const rows = await this.prisma.biBestPracticeCycleResponse.findMany({
      select: {
        id: true,
        batchId: true,
        identification: true,
        specialty: true,
      },
    });

    return rows.map((row) =>
      this.resolveByCompositeReference({
        sourceType: BI_NORMALIZATION_SOURCE_TYPES.BEST_PRACTICE_CYCLE,
        sourceRecordId: row.id,
        sourceBatchId: row.batchId,
        rawReference: row.identification,
        secondaryReference: row.specialty,
        omCatalog,
        localityCatalog,
      }),
    );
  }

  private async normalizeJsonDrivenSource(
    sourceType: BiNormalizationSourceTypeValue,
    modelName: 'biCpcaMeetingResponse' | 'biGsdEvaluationResponse',
    omCatalog: OmCatalogItem[],
    localityCatalog: LocalityCatalogItem[],
  ) {
    const model = (this.prisma as any)[modelName];
    const rows = await model.findMany({
      select: {
        id: true,
        batchId: true,
        answersJson: true,
        rawPayload: true,
      },
    });

    return rows.map((row: any) => {
      const candidate = this.extractJsonCandidate(row?.answersJson, row?.rawPayload);
      return this.resolveByCompositeReference({
        sourceType,
        sourceRecordId: String(row?.id ?? ''),
        sourceBatchId: String(row?.batchId ?? '') || null,
        rawReference: candidate.rawReference,
        secondaryReference: candidate.secondaryReference,
        directUf: candidate.directUf,
        omCatalog,
        localityCatalog,
      });
    });
  }

  private resolveByOmReference(args: {
    sourceType: BiNormalizationSourceTypeValue;
    sourceRecordId: string;
    sourceBatchId?: string | null;
    rawReference?: string | null;
    omCatalog: OmCatalogItem[];
    fallbackStatus: BiNormalizationStatusValue;
  }): LinkInput {
    const rawReference = normalizeDisplayText(args.rawReference);
    const matchedOm = this.matchOm(rawReference, args.omCatalog);
    if (matchedOm) {
      return {
        sourceType: args.sourceType,
        sourceRecordId: args.sourceRecordId,
        sourceBatchId: args.sourceBatchId,
        rawReference,
        omId: matchedOm.id,
        uf: matchedOm.uf,
        status: BI_NORMALIZATION_STATUSES.MATCHED,
        confidence: matchedOm.confidence,
        resolutionMethod: matchedOm.method,
      };
    }

    return {
      sourceType: args.sourceType,
      sourceRecordId: args.sourceRecordId,
      sourceBatchId: args.sourceBatchId,
      rawReference,
      status: rawReference ? args.fallbackStatus : BI_NORMALIZATION_STATUSES.NOT_FOUND,
      resolutionMethod: rawReference ? 'OM_REFERENCE_NOT_RESOLVED' : 'EMPTY_REFERENCE',
    };
  }

  private resolveByCompositeReference(args: {
    sourceType: BiNormalizationSourceTypeValue;
    sourceRecordId: string;
    sourceBatchId?: string | null;
    rawReference?: string | null;
    secondaryReference?: string | null;
    directUf?: string | null;
    omCatalog: OmCatalogItem[];
    localityCatalog: LocalityCatalogItem[];
  }): LinkInput {
    const rawReference = normalizeDisplayText(args.rawReference);
    const secondaryReference = normalizeDisplayText(args.secondaryReference);
    const matchedOm = this.matchOm(rawReference || secondaryReference, args.omCatalog);
    if (matchedOm) {
      return {
        sourceType: args.sourceType,
        sourceRecordId: args.sourceRecordId,
        sourceBatchId: args.sourceBatchId,
        rawReference,
        secondaryReference,
        omId: matchedOm.id,
        uf: matchedOm.uf,
        status: BI_NORMALIZATION_STATUSES.MATCHED,
        confidence: matchedOm.confidence,
        resolutionMethod: matchedOm.method,
      };
    }

    const matchedLocality = this.matchLocality(
      rawReference || secondaryReference,
      args.localityCatalog,
    );
    if (matchedLocality?.uf) {
      return {
        sourceType: args.sourceType,
        sourceRecordId: args.sourceRecordId,
        sourceBatchId: args.sourceBatchId,
        rawReference,
        secondaryReference,
        uf: matchedLocality.uf,
        status: BI_NORMALIZATION_STATUSES.UF_ONLY,
        confidence: matchedLocality.confidence,
        resolutionMethod: matchedLocality.method,
      };
    }

    const directUf = normalizeUfCode(args.directUf ?? rawReference ?? secondaryReference);
    if (directUf) {
      return {
        sourceType: args.sourceType,
        sourceRecordId: args.sourceRecordId,
        sourceBatchId: args.sourceBatchId,
        rawReference,
        secondaryReference,
        uf: directUf,
        status: BI_NORMALIZATION_STATUSES.UF_ONLY,
        confidence: 0.66,
        resolutionMethod: 'DIRECT_UF',
      };
    }

    return {
      sourceType: args.sourceType,
      sourceRecordId: args.sourceRecordId,
      sourceBatchId: args.sourceBatchId,
      rawReference,
      secondaryReference,
      status: BI_NORMALIZATION_STATUSES.NOT_FOUND,
      resolutionMethod: rawReference || secondaryReference ? 'NO_HEURISTIC_MATCH' : 'EMPTY_REFERENCE',
    };
  }

  private extractJsonCandidate(
    answersJson: Prisma.JsonValue | null | undefined,
    rawPayload: Prisma.JsonValue | null | undefined,
  ): JsonCandidate {
    const combinedEntries = [answersJson, rawPayload]
      .map((value) => this.jsonEntries(value))
      .flat();

    const pickFirstValue = (predicates: string[]) => {
      const match = combinedEntries.find((entry) => {
        const key = normalizeFabOm(entry.key);
        return predicates.some((token) => key.includes(token));
      });
      return normalizeDisplayText(match?.value);
    };

    return {
      rawReference:
        pickFirstValue([
          'ORGANIZACAO',
          'ORGANIZAÇÃO',
          'OM',
          'UNIDADE',
          'BASE',
          'ESQUADRAO',
          'ESQUADRÃO',
          'GUARNICAO',
          'GUARNIÇÃO',
        ]) || null,
      secondaryReference:
        pickFirstValue([
          'LOCALIDADE',
          'CIDADE',
          'MUNICIPIO',
          'MUNICÍPIO',
          'SETOR',
          'AREA',
          'ÁREA',
        ]) || null,
      directUf:
        pickFirstValue([
          'UF',
          'ESTADO',
        ]) || null,
    };
  }

  private jsonEntries(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [] as Array<{ key: string; value: string }>;
    return Object.entries(value as Record<string, unknown>)
      .map(([key, rawValue]) => ({
        key,
        value: normalizeDisplayText(rawValue as string | null | undefined),
      }))
      .filter((entry) => entry.value.length > 0);
  }

  private async persistLinks(
    sourceType: BiNormalizationSourceTypeValue,
    links: LinkInput[],
  ) {
    const ids = links.map((item) => item.sourceRecordId).filter(Boolean);
    await this.prisma.biNormalizationLink.deleteMany({
      where: {
        sourceType,
        ...(ids.length > 0
          ? { sourceRecordId: { notIn: ids } }
          : undefined),
      },
    });

    const chunks = this.chunk(links, 200);
    for (const chunk of chunks) {
      await this.prisma.$transaction(
        chunk.map((item) =>
          this.prisma.biNormalizationLink.upsert({
            where: {
              sourceType_sourceRecordId: {
                sourceType: item.sourceType,
                sourceRecordId: item.sourceRecordId,
              },
            },
            create: {
              sourceType: item.sourceType,
              sourceRecordId: item.sourceRecordId,
              sourceBatchId: item.sourceBatchId ?? null,
              rawReference: item.rawReference ?? null,
              secondaryReference: item.secondaryReference ?? null,
              omId: item.omId ?? null,
              uf: item.uf ?? null,
              status: item.status,
              confidence: item.confidence ?? null,
              resolutionMethod: item.resolutionMethod ?? null,
            },
            update: {
              sourceBatchId: item.sourceBatchId ?? null,
              rawReference: item.rawReference ?? null,
              secondaryReference: item.secondaryReference ?? null,
              omId: item.omId ?? null,
              uf: item.uf ?? null,
              status: item.status,
              confidence: item.confidence ?? null,
              resolutionMethod: item.resolutionMethod ?? null,
            },
          }),
        ),
      );
    }
  }

  private chunk<T>(values: T[], size: number) {
    const result: T[][] = [];
    for (let index = 0; index < values.length; index += size) {
      result.push(values.slice(index, index + size));
    }
    return result;
  }

  private async loadOmCatalog(): Promise<OmCatalogItem[]> {
    const items = await this.prisma.om.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        uf: true,
      },
    });
    return items.map((item) => ({
      ...item,
      codeKey: normalizeKey(item.code),
      nameKey: normalizeKey(item.name),
    }));
  }

  private async loadLocalityCatalog(): Promise<LocalityCatalogItem[]> {
    const items = await this.prisma.locality.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        uf: true,
      },
    });
    return items.map((item) => ({
      ...item,
      codeKey: normalizeKey(item.code),
      nameKey: normalizeKey(item.name),
    }));
  }

  private matchOm(reference: string, catalog: OmCatalogItem[]) {
    const normalized = normalizeDisplayText(reference);
    if (!normalized) return null;

    const candidates = new Set<string>([normalized]);
    for (const token of normalized.split(/[\/|;,]+/)) {
      const trimmed = normalizeDisplayText(token);
      if (trimmed.length > 2) candidates.add(trimmed);
    }
    if (normalized.includes('-')) {
      for (const token of normalized.split('-')) {
        const trimmed = normalizeDisplayText(token);
        if (trimmed.length > 2) candidates.add(trimmed);
      }
    }

    let best: OmCatalogItem | null = null;
    let bestScore = -1;
    for (const candidate of candidates) {
      const candidateKey = normalizeKey(candidate);
      if (!candidateKey) continue;
      for (const row of catalog) {
        const score = computeOmScore(row.codeKey, row.nameKey, candidateKey);
        if (score > bestScore) {
          best = row;
          bestScore = score;
          continue;
        }
        if (score === bestScore && best) {
          if (row.codeKey.length > best.codeKey.length) best = row;
        }
      }
    }

    if (!best || bestScore < 0) return null;
    return {
      ...best,
      confidence: bestScore >= 1400 ? 1 : bestScore >= 1200 ? 0.92 : 0.82,
      method: bestScore >= 1400 ? 'OM_EXACT' : 'OM_HEURISTIC',
    };
  }

  private matchLocality(reference: string, catalog: LocalityCatalogItem[]) {
    const normalized = normalizeDisplayText(reference);
    if (!normalized) return null;
    const candidateKey = normalizeKey(normalized);
    if (!candidateKey) return null;

    let best: LocalityCatalogItem | null = null;
    let bestScore = -1;
    for (const row of catalog) {
      const score = computeLocalityScore(row.codeKey, row.nameKey, candidateKey);
      if (score > bestScore) {
        best = row;
        bestScore = score;
      }
    }

    if (!best || bestScore < 0) return null;
    return {
      ...best,
      confidence: bestScore >= 1200 ? 0.88 : 0.72,
      method: bestScore >= 1200 ? 'LOCALITY_EXACT' : 'LOCALITY_HEURISTIC',
    };
  }

  private async countSourceRecords(sourceType: BiNormalizationSourceTypeValue) {
    switch (sourceType) {
      case BI_NORMALIZATION_SOURCE_TYPES.SURVEY_SCHOOLS:
        return this.prisma.biSurveyResponse.count();
      case BI_NORMALIZATION_SOURCE_TYPES.DOMESTIC_VIOLENCE:
        return this.prisma.biDomesticViolenceResponse.count();
      case BI_NORMALIZATION_SOURCE_TYPES.RECRUITS:
        return this.prisma.biRecruitsResponse.count();
      case BI_NORMALIZATION_SOURCE_TYPES.BEST_PRACTICE_CYCLE:
        return this.prisma.biBestPracticeCycleResponse.count();
      case BI_NORMALIZATION_SOURCE_TYPES.CPCA_MEETING:
        return (this.prisma as any).biCpcaMeetingResponse.count();
      case BI_NORMALIZATION_SOURCE_TYPES.GSD_EVALUATION:
        return (this.prisma as any).biGsdEvaluationResponse.count();
      default:
        return 0;
    }
  }
}
