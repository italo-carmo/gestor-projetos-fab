import { Injectable, Logger } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import {
  buildFabOmCandidateSet,
  buildFabOmRowAliasSet,
  normalizeFabOm,
} from '../catalog/om-resolver';
import { LitellmService } from '../llm/litellm.service';
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
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]);

type SourceCapability = 'OM_UF' | 'UF_HEURISTIC' | 'NONE';
type ResolutionInputType = 'raw' | 'secondary' | null;
type TargetFieldSource = 'SCALAR' | 'JSON' | 'NONE';

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
  aliasKeys: string[];
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

type JsonEntry = {
  key: string;
  label: string;
  value: string;
  source: 'answersJson' | 'rawPayload';
};

type JsonFieldCandidate = {
  value: string | null;
  key: string | null;
  label: string | null;
};

type JsonCandidate = {
  rawReference?: string | null;
  secondaryReference?: string | null;
  directUf?: string | null;
  rawFieldKey?: string | null;
  rawFieldLabel?: string | null;
  secondaryFieldKey?: string | null;
  secondaryFieldLabel?: string | null;
};

type SuggestedResolution = {
  status: BiNormalizationStatusValue;
  om?: OmCatalogItem | null;
  uf?: string | null;
  confidence?: number | null;
  resolutionMethod?: string | null;
  matchedInput?: ResolutionInputType;
  reasoning?: string | null;
};

type ResolvedSourceRecord = LinkInput & {
  targetFieldKey: string | null;
  targetFieldLabel: string | null;
  targetFieldSource: TargetFieldSource;
  currentTargetValue: string | null;
  targetReference: string | null;
  needsWriteback: boolean;
  suggestedOm: OmCatalogItem | null;
  matchedInput: ResolutionInputType;
  reasoning?: string | null;
  answersJson?: Prisma.JsonValue | null;
  rawPayload?: Prisma.JsonValue | null;
};

type ReviewGroupStatus = 'READY_TO_APPLY' | 'NEEDS_MANUAL_SELECTION';

type ReviewVariant = {
  value: string;
  count: number;
};

type ReviewGroup = {
  id: string;
  sourceType: BiNormalizationSourceTypeValue;
  fieldLabel: string;
  targetFieldSource: TargetFieldSource;
  status: ReviewGroupStatus;
  totalRecords: number;
  recordIds: string[];
  variants: ReviewVariant[];
  suggestedOm: {
    id: string;
    code: string;
    name: string;
    uf: string | null;
  } | null;
  targetReference: string | null;
  confidence: number | null;
  resolutionMethod: string | null;
  reasoning: string | null;
  sampleValue: string | null;
  summary: string;
};

type ReviewSourceSummary = {
  sourceType: BiNormalizationSourceTypeValue;
  label: string;
  description: string;
  supported: boolean;
  totalGroups: number;
  totalRecords: number;
  readyGroups: number;
  readyRecords: number;
  unresolvedGroups: number;
  unresolvedRecords: number;
  groups: ReviewGroup[];
};

type ApplyNormalizationParams = {
  sourceType: BiNormalizationSourceTypeValue | string | null | undefined;
  sourceRecordIds: string[];
  omId?: string | null;
};

export type BiImportNormalizationFieldKind = 'OM' | 'SPECIALTY';

export type BiImportNormalizationInputField = {
  fieldKey: string;
  fieldLabel: string;
  kind: BiImportNormalizationFieldKind;
  value?: string | null;
};

export type BiImportNormalizationInputRow = {
  rowNumber: number;
  fields: BiImportNormalizationInputField[];
};

export type BiImportNormalizationSuggestion = {
  id: string;
  sourceType: BiNormalizationSourceTypeValue;
  fieldKey: string;
  fieldLabel: string;
  kind: BiImportNormalizationFieldKind;
  originalValue: string;
  suggestedValue: string;
  confidence: number | null;
  resolutionMethod: string | null;
  reasoning: string | null;
  rowCount: number;
  sampleRows: number[];
};

export type BiImportNormalizationUnresolved = {
  id: string;
  sourceType: BiNormalizationSourceTypeValue;
  fieldKey: string;
  fieldLabel: string;
  kind: Extract<BiImportNormalizationFieldKind, 'OM'>;
  originalValue: string;
  resolutionMethod: string | null;
  reasoning: string | null;
  rowCount: number;
  sampleRows: number[];
};

export type BiImportNormalizationPreview = {
  sourceType: BiNormalizationSourceTypeValue;
  totalRows: number;
  suggestions: BiImportNormalizationSuggestion[];
  unresolved: BiImportNormalizationUnresolved[];
  summary: {
    suggestionCount: number;
    unresolvedCount: number;
    omSuggestionCount: number;
    specialtySuggestionCount: number;
  };
};

export type BiImportNormalizationDecision = {
  id: string;
  apply: boolean;
};

export type BiImportNormalizationPlan = {
  decisions?: BiImportNormalizationDecision[];
};

const SOURCE_CONFIGS: SourceConfig[] = [
  {
    sourceType: BI_NORMALIZATION_SOURCE_TYPES.SURVEY_SCHOOLS,
    label: 'Pesquisas de escolas',
    description:
      'Normalização pelo campo OM da resposta, com resolução para OM e UF.',
    capability: 'OM_UF',
  },
  {
    sourceType: BI_NORMALIZATION_SOURCE_TYPES.DOMESTIC_VIOLENCE,
    label: 'Pesquisa de violência doméstica',
    description:
      'Normalização pelo campo organização, com resolução para OM e UF.',
    capability: 'OM_UF',
  },
  {
    sourceType: BI_NORMALIZATION_SOURCE_TYPES.RECRUITS,
    label: 'Pesquisa de recrutas',
    description:
      'Fonte sem chave organizacional nativa; fica sinalizada como não aplicável.',
    capability: 'NONE',
  },
  {
    sourceType: BI_NORMALIZATION_SOURCE_TYPES.BEST_PRACTICE_CYCLE,
    label: 'Pesquisa ciclo de boas práticas',
    description:
      'Usa identificação da resposta para inferir OM e UF quando houver referência organizacional.',
    capability: 'UF_HEURISTIC',
  },
  {
    sourceType: BI_NORMALIZATION_SOURCE_TYPES.CPCA_MEETING,
    label: 'Pesquisa encontro CPCA',
    description:
      'Heurística e IA sobre respostas livres para detectar OM, localidade ou UF.',
    capability: 'UF_HEURISTIC',
  },
  {
    sourceType: BI_NORMALIZATION_SOURCE_TYPES.GSD_EVALUATION,
    label: 'Pesquisa avaliação GSD',
    description:
      'Heurística e IA sobre respostas livres para detectar OM, localidade ou UF.',
    capability: 'UF_HEURISTIC',
  },
];

const JSON_OM_KEY_TOKENS = [
  'ORGANIZACAO',
  'ORGANIZAÇÃO',
  'OM',
  'UNIDADE',
  'BASE',
  'ESQUADRAO',
  'ESQUADRÃO',
  'GUARNICAO',
  'GUARNIÇÃO',
];

const JSON_SECONDARY_KEY_TOKENS = [
  'LOCALIDADE',
  'CIDADE',
  'MUNICIPIO',
  'MUNICÍPIO',
  'SETOR',
  'AREA',
  'ÁREA',
];

const JSON_UF_KEY_TOKENS = ['UF', 'ESTADO'];

function normalizeKey(value: string | null | undefined) {
  return normalizeFabOm(value).replace(/[^A-Z0-9]/g, '');
}

function normalizeDisplayText(value: string | null | undefined) {
  return String(value ?? '').trim();
}

function collapseImportWhitespace(value: string | null | undefined) {
  return normalizeDisplayText(value).replace(/\s+/g, ' ').trim();
}

function normalizeSpecialtyKey(value: string | null | undefined) {
  return collapseImportWhitespace(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function formatSpecialtyToken(value: string) {
  const token = String(value ?? '').trim();
  if (!token) return '';
  const normalized = token
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  if (/^(?:GSD|CPCA|TI|OM|FAB|RH|TI|TI\/RH|SMS|S1|S2|S3|S4)$/.test(normalized)) {
    return normalized;
  }
  if (/^(?:I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)$/.test(normalized)) {
    return normalized;
  }
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

function buildCanonicalSpecialtyValue(value: string | null | undefined) {
  return collapseImportWhitespace(value)
    .split(' ')
    .filter(Boolean)
    .map((chunk) =>
      chunk
        .split('/')
        .map((part) => formatSpecialtyToken(part))
        .join('/'),
    )
    .join(' ')
    .trim();
}

function normalizeUfCode(value: string | null | undefined) {
  const raw = normalizeFabOm(value);
  if (UF_CODES.has(raw)) return raw;
  return null;
}

function stringifyLabel(value: string | null | undefined) {
  return normalizeDisplayText(value).replace(/[_]+/g, ' ');
}

function parseJsonObject(text: string) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return null;
  const directTry = (() => {
    try {
      return JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return null;
    }
  })();
  if (directTry && typeof directTry === 'object' && !Array.isArray(directTry)) {
    return directTry;
  }
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function computeOmScore(
  rowCode: string,
  rowName: string,
  candidateKey: string,
  rowAliases: string[] = [],
) {
  const rowKeys = [rowCode, rowName, ...rowAliases].filter(Boolean);
  let score = -1;
  for (const rowKey of rowKeys) {
    if (rowKey === candidateKey) {
      const exactBonus =
        rowKey === rowCode ? 2000 : rowKey === rowName ? 1700 : 1600;
      score = Math.max(score, exactBonus + rowKey.length);
    }
    if (rowKey.length >= 4 && candidateKey.includes(rowKey)) {
      const containsBonus =
        rowKey === rowCode ? 1400 : rowKey === rowName ? 1200 : 1150;
      score = Math.max(score, containsBonus + rowKey.length);
    }
    if (candidateKey.length >= 4 && rowKey.includes(candidateKey)) {
      const inverseBonus =
        rowKey === rowCode ? 1350 : rowKey === rowName ? 1180 : 1120;
      score = Math.max(score, inverseBonus + candidateKey.length);
    }
    if (
      rowKey &&
      candidateKey &&
      rowKey.length >= 5 &&
      candidateKey.length >= 5 &&
      (rowKey.endsWith(candidateKey) || candidateKey.endsWith(rowKey))
    ) {
      const suffixBonus =
        rowKey === rowCode ? 1000 : rowKey === rowName ? 920 : 900;
      score = Math.max(
        score,
        suffixBonus + Math.min(rowKey.length, candidateKey.length),
      );
    }
  }
  return score;
}

function computeLocalityScore(
  rowCode: string,
  rowName: string,
  candidateKey: string,
) {
  let score = -1;
  if (rowCode && rowCode === candidateKey)
    score = Math.max(score, 1200 + rowCode.length);
  if (rowName && rowName === candidateKey)
    score = Math.max(score, 1000 + rowName.length);
  if (rowName && rowName.length >= 4 && candidateKey.includes(rowName)) {
    score = Math.max(score, 920 + rowName.length);
  }
  if (
    rowCode &&
    candidateKey &&
    rowCode.length >= 2 &&
    candidateKey.includes(rowCode)
  ) {
    score = Math.max(score, 850 + rowCode.length);
  }
  return score;
}

function buildAiCacheKey(values: Array<string | null | undefined>) {
  return values.map((value) => normalizeKey(value)).join('|');
}

function cloneJsonObject(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }
  return { ...(value as Record<string, unknown>) };
}

@Injectable()
export class BiNormalizationService {
  private readonly logger = new Logger(BiNormalizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly litellm?: LitellmService,
  ) {}

  async previewImportRows(params: {
    sourceType: BiNormalizationSourceTypeValue;
    rows: BiImportNormalizationInputRow[];
  }): Promise<BiImportNormalizationPreview> {
    const omCatalog = await this.loadOmCatalog();
    const omSuggestionCache = new Map<string, Promise<SuggestedResolution>>();
    const suggestions = new Map<string, BiImportNormalizationSuggestion>();
    const unresolved = new Map<string, BiImportNormalizationUnresolved>();
    const specialtyVariants = new Map<
      string,
      {
        fieldKey: string;
        fieldLabel: string;
        variants: Map<string, { count: number; sampleRows: number[] }>;
      }
    >();

    for (const row of params.rows) {
      for (const field of row.fields ?? []) {
        const fieldValue = collapseImportWhitespace(field.value);
        if (!fieldValue) continue;

        if (field.kind === 'OM') {
          const suggestion = await this.resolveOmSuggestionCached(
            fieldValue,
            omCatalog,
            omSuggestionCache,
          );
          if (
            suggestion.status === BI_NORMALIZATION_STATUSES.MATCHED &&
            suggestion.om
          ) {
            const suggestedValue = String(suggestion.om.code ?? '').trim();
            if (!suggestedValue || suggestedValue === fieldValue) continue;
            const id = `${field.kind}:${field.fieldKey}:${encodeURIComponent(
              fieldValue,
            )}`;
            const existing = suggestions.get(id);
            suggestions.set(id, {
              id,
              sourceType: params.sourceType,
              fieldKey: field.fieldKey,
              fieldLabel: field.fieldLabel,
              kind: field.kind,
              originalValue: fieldValue,
              suggestedValue,
              confidence: suggestion.confidence ?? null,
              resolutionMethod: suggestion.resolutionMethod ?? null,
              reasoning: suggestion.reasoning ?? null,
              rowCount: (existing?.rowCount ?? 0) + 1,
              sampleRows: this.pushSampleRow(existing?.sampleRows, row.rowNumber),
            });
            continue;
          }

          const unresolvedId = `${field.kind}:${field.fieldKey}:${encodeURIComponent(
            fieldValue,
          )}`;
          const existing = unresolved.get(unresolvedId);
          unresolved.set(unresolvedId, {
            id: unresolvedId,
            sourceType: params.sourceType,
            fieldKey: field.fieldKey,
            fieldLabel: field.fieldLabel,
            kind: 'OM',
            originalValue: fieldValue,
            resolutionMethod: suggestion.resolutionMethod ?? null,
            reasoning: suggestion.reasoning ?? null,
            rowCount: (existing?.rowCount ?? 0) + 1,
            sampleRows: this.pushSampleRow(existing?.sampleRows, row.rowNumber),
          });
          continue;
        }

        const specialtyKey = `${field.fieldKey}:${normalizeSpecialtyKey(fieldValue)}`;
        const bucket = specialtyVariants.get(specialtyKey) ?? {
          fieldKey: field.fieldKey,
          fieldLabel: field.fieldLabel,
          variants: new Map<string, { count: number; sampleRows: number[] }>(),
        };
        const currentVariant = bucket.variants.get(fieldValue);
        bucket.variants.set(fieldValue, {
          count: (currentVariant?.count ?? 0) + 1,
          sampleRows: this.pushSampleRow(currentVariant?.sampleRows, row.rowNumber),
        });
        specialtyVariants.set(specialtyKey, bucket);
      }
    }

    for (const [bucketKey, bucket] of specialtyVariants.entries()) {
      const normalizedKey = bucketKey.split(':').slice(1).join(':');
      if (!normalizedKey) continue;
      const variants = Array.from(bucket.variants.entries()).map(
        ([value, meta]) => ({
          value,
          count: meta.count,
          sampleRows: meta.sampleRows,
        }),
      );
      const canonical = this.chooseCanonicalSpecialtyValue(variants);
      if (!canonical) continue;

      for (const variant of variants) {
        const currentValue = collapseImportWhitespace(variant.value);
        if (!currentValue || currentValue === canonical) continue;
        const id = `SPECIALTY:${bucket.fieldKey}:${encodeURIComponent(
          currentValue,
        )}`;
        suggestions.set(id, {
          id,
          sourceType: params.sourceType,
          fieldKey: bucket.fieldKey,
          fieldLabel: bucket.fieldLabel,
          kind: 'SPECIALTY',
          originalValue: currentValue,
          suggestedValue: canonical,
          confidence: 1,
          resolutionMethod: 'CASE_SPACE_NORMALIZATION',
          reasoning:
            'Padronização conservadora de caixa e espaços, sem alterar o significado informado.',
          rowCount: variant.count,
          sampleRows: variant.sampleRows,
        });
      }
    }

    const suggestionList = Array.from(suggestions.values()).sort((a, b) => {
      if (a.kind !== b.kind) return a.kind.localeCompare(b.kind, 'pt-BR');
      if (a.fieldLabel !== b.fieldLabel)
        return a.fieldLabel.localeCompare(b.fieldLabel, 'pt-BR');
      return (
        b.rowCount - a.rowCount ||
        a.originalValue.localeCompare(b.originalValue, 'pt-BR')
      );
    });

    const unresolvedList = Array.from(unresolved.values()).sort(
      (a, b) =>
        b.rowCount - a.rowCount ||
        a.fieldLabel.localeCompare(b.fieldLabel, 'pt-BR') ||
        a.originalValue.localeCompare(b.originalValue, 'pt-BR'),
    );

    return {
      sourceType: params.sourceType,
      totalRows: params.rows.length,
      suggestions: suggestionList,
      unresolved: unresolvedList,
      summary: {
        suggestionCount: suggestionList.length,
        unresolvedCount: unresolvedList.length,
        omSuggestionCount: suggestionList.filter((item) => item.kind === 'OM')
          .length,
        specialtySuggestionCount: suggestionList.filter(
          (item) => item.kind === 'SPECIALTY',
        ).length,
      },
    };
  }

  applyImportNormalization<T extends Record<string, any>>(
    rows: T[],
    preview: BiImportNormalizationPreview | null | undefined,
    plan?: BiImportNormalizationPlan | null,
  ) {
    const acceptedIds = new Set(
      (plan?.decisions ?? [])
        .filter((item) => item?.apply)
        .map((item) => String(item.id ?? '').trim())
        .filter(Boolean),
    );

    if (!preview || acceptedIds.size === 0) {
      return {
        rows,
        appliedSuggestions: 0,
        updatedFields: 0,
      };
    }

    const suggestionMap = new Map<
      string,
      { fieldKey: string; originalValue: string; suggestedValue: string }
    >();
    for (const suggestion of preview.suggestions) {
      if (!acceptedIds.has(suggestion.id)) continue;
      suggestionMap.set(suggestion.id, {
        fieldKey: suggestion.fieldKey,
        originalValue: suggestion.originalValue,
        suggestedValue: suggestion.suggestedValue,
      });
    }

    if (suggestionMap.size === 0) {
      return {
        rows,
        appliedSuggestions: 0,
        updatedFields: 0,
      };
    }

    let updatedFields = 0;
    const nextRows = rows.map((row) => {
      let changed = false;
      const nextRow: Record<string, any> = { ...row };
      for (const suggestion of suggestionMap.values()) {
        const currentValue = collapseImportWhitespace(
          nextRow[suggestion.fieldKey] as string | null | undefined,
        );
        if (currentValue !== suggestion.originalValue) continue;
        nextRow[suggestion.fieldKey] = suggestion.suggestedValue;
        updatedFields += 1;
        changed = true;
      }
      return changed ? (nextRow as T) : row;
    });

    return {
      rows: nextRows,
      appliedSuggestions: suggestionMap.size,
      updatedFields,
    };
  }

  async overview() {
    const [sourceSummaries, latestUpdate] = await Promise.all([
      Promise.all(
        SOURCE_CONFIGS.map((config) => this.buildSourceSummary(config)),
      ),
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
        item,
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
                  (totals.supportedResolved / totals.supportedRecords) * 100 ||
                  0
                ).toFixed(1),
              )
            : 0,
      },
      sources: sourceSummaries,
    };
  }

  async review(params?: {
    sourceType?: BiNormalizationSourceTypeValue | string | null;
  }) {
    const targets = this.resolveTargetConfigs(params?.sourceType ?? null);
    const omCatalog = await this.loadOmCatalog();
    const localityCatalog = await this.loadLocalityCatalog();

    const sources = await Promise.all(
      targets.map((config) =>
        this.buildSourceReview(config, omCatalog, localityCatalog),
      ),
    );

    const overall = sources.reduce(
      (acc, source) => {
        acc.totalGroups += source.totalGroups;
        acc.totalRecords += source.totalRecords;
        acc.readyGroups += source.readyGroups;
        acc.readyRecords += source.readyRecords;
        acc.unresolvedGroups += source.unresolvedGroups;
        acc.unresolvedRecords += source.unresolvedRecords;
        return acc;
      },
      {
        totalGroups: 0,
        totalRecords: 0,
        readyGroups: 0,
        readyRecords: 0,
        unresolvedGroups: 0,
        unresolvedRecords: 0,
      },
    );

    return {
      generatedAt: new Date().toISOString(),
      overall,
      sources,
    };
  }

  async rebuild(params?: {
    sourceType?: BiNormalizationSourceTypeValue | string | null;
  }) {
    const targets = this.resolveTargetConfigs(params?.sourceType ?? null);
    if (targets.length === 0) {
      return { processed: [], generatedAt: new Date().toISOString() };
    }

    const omCatalog = await this.loadOmCatalog();
    const localityCatalog = await this.loadLocalityCatalog();
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
      results.push(
        await this.rebuildSource(config, omCatalog, localityCatalog),
      );
    }

    return {
      generatedAt: new Date().toISOString(),
      processed: results,
    };
  }

  async apply(params: ApplyNormalizationParams) {
    const config = this.requireConfig(params.sourceType);
    const recordIds = Array.from(
      new Set(
        (params.sourceRecordIds ?? [])
          .map((item) => String(item ?? '').trim())
          .filter(Boolean),
      ),
    );
    if (recordIds.length === 0) {
      return { applied: 0, sourceType: config.sourceType, reprocessed: false };
    }

    const omCatalog = await this.loadOmCatalog();
    const localityCatalog = await this.loadLocalityCatalog();
    const resolved = await this.resolveSourceRecords(
      config,
      omCatalog,
      localityCatalog,
      recordIds,
    );
    const selectedOm = params.omId
      ? (omCatalog.find((item) => item.id === String(params.omId).trim()) ??
        null)
      : null;

    const mutations: Prisma.PrismaPromise<any>[] = [];
    for (const row of resolved) {
      const chosenOm = selectedOm ?? row.suggestedOm;
      if (!chosenOm) continue;
      const nextReference = chosenOm.code;
      const mutation = this.buildApplyMutation(
        config.sourceType,
        row,
        nextReference,
      );
      if (mutation) mutations.push(mutation);
    }

    if (mutations.length === 0) {
      await this.rebuild({ sourceType: config.sourceType });
      return { applied: 0, sourceType: config.sourceType, reprocessed: true };
    }

    for (const chunk of this.chunk(mutations, 100)) {
      await this.prisma.$transaction(chunk);
    }

    await this.rebuild({ sourceType: config.sourceType });

    return {
      applied: mutations.length,
      sourceType: config.sourceType,
      canonicalOmCode: selectedOm?.code ?? null,
      reprocessed: true,
    };
  }

  async applyReady(params?: {
    sourceType?: BiNormalizationSourceTypeValue | string | null;
  }) {
    const targets = this.resolveTargetConfigs(params?.sourceType ?? null);
    if (targets.length === 0) {
      return { generatedAt: new Date().toISOString(), processed: [] };
    }

    const review = await this.review({
      sourceType: params?.sourceType ?? null,
    });
    const processed = [] as Array<{ sourceType: string; applied: number }>;

    for (const source of review.sources) {
      const readyRecordIds = source.groups
        .filter(
          (group) => group.status === 'READY_TO_APPLY' && group.targetReference,
        )
        .flatMap((group) => group.recordIds);
      if (readyRecordIds.length === 0) {
        processed.push({ sourceType: source.sourceType, applied: 0 });
        continue;
      }
      const result = await this.apply({
        sourceType: source.sourceType,
        sourceRecordIds: readyRecordIds,
      });
      processed.push({
        sourceType: source.sourceType,
        applied: Number(result.applied ?? 0),
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      processed,
    };
  }

  private resolveTargetConfigs(
    sourceType: BiNormalizationSourceTypeValue | string | null | undefined,
  ) {
    const requestedType = String(sourceType ?? '').trim();
    return requestedType
      ? SOURCE_CONFIGS.filter((config) => config.sourceType === requestedType)
      : SOURCE_CONFIGS;
  }

  private requireConfig(
    sourceType: BiNormalizationSourceTypeValue | string | null | undefined,
  ) {
    const config = SOURCE_CONFIGS.find(
      (item) => item.sourceType === String(sourceType ?? '').trim(),
    );
    if (!config) {
      throw new Error('Fonte de normalização BI inválida.');
    }
    return config;
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
      },
    });

    const statusCounts = {
      matched: 0,
      ufOnly: 0,
      notFound: 0,
      notApplicable: 0,
    };

    for (const link of links) {
      if (link.status === BI_NORMALIZATION_STATUSES.MATCHED)
        statusCounts.matched += 1;
      else if (link.status === BI_NORMALIZATION_STATUSES.UF_ONLY)
        statusCounts.ufOnly += 1;
      else if (link.status === BI_NORMALIZATION_STATUSES.NOT_FOUND)
        statusCounts.notFound += 1;
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
      ? Number(
          ((resolvedCount / Math.max(totalRecords, 1)) * 100 || 0).toFixed(1),
        )
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
        .filter((item) => item.status === BI_NORMALIZATION_STATUSES.NOT_FOUND)
        .slice(0, 5)
        .map((item) => ({
          rawReference: item.rawReference,
          secondaryReference: item.secondaryReference,
        })),
    };
  }

  private async buildSourceReview(
    config: SourceConfig,
    omCatalog: OmCatalogItem[],
    localityCatalog: LocalityCatalogItem[],
  ): Promise<ReviewSourceSummary> {
    if (config.capability === 'NONE') {
      return {
        sourceType: config.sourceType,
        label: config.label,
        description: config.description,
        supported: false,
        totalGroups: 0,
        totalRecords: 0,
        readyGroups: 0,
        readyRecords: 0,
        unresolvedGroups: 0,
        unresolvedRecords: 0,
        groups: [],
      };
    }

    const resolved = await this.resolveSourceRecords(
      config,
      omCatalog,
      localityCatalog,
    );
    const pendingRows = resolved.filter(
      (row) =>
        row.currentTargetValue && (row.needsWriteback || !row.targetReference),
    );

    const groupsMap = new Map<string, ReviewGroup>();
    for (const row of pendingRows) {
      const currentValue = normalizeDisplayText(row.currentTargetValue);
      if (!currentValue) continue;
      const groupKey = [
        config.sourceType,
        row.targetFieldKey ?? 'field',
        row.targetReference ?? 'manual',
        normalizeKey(currentValue),
      ].join('::');

      const status: ReviewGroupStatus = row.targetReference
        ? 'READY_TO_APPLY'
        : 'NEEDS_MANUAL_SELECTION';

      const existing = groupsMap.get(groupKey);
      if (existing) {
        existing.totalRecords += 1;
        existing.recordIds.push(row.sourceRecordId);
        const variant = existing.variants.find(
          (item) => item.value === currentValue,
        );
        if (variant) variant.count += 1;
        else existing.variants.push({ value: currentValue, count: 1 });
        if (typeof row.confidence === 'number') {
          existing.confidence = Math.max(
            existing.confidence ?? 0,
            row.confidence,
          );
        }
        if (!existing.reasoning && row.reasoning)
          existing.reasoning = row.reasoning;
        continue;
      }

      groupsMap.set(groupKey, {
        id: groupKey,
        sourceType: config.sourceType,
        fieldLabel: row.targetFieldLabel ?? 'Campo organizacional',
        targetFieldSource: row.targetFieldSource,
        status,
        totalRecords: 1,
        recordIds: [row.sourceRecordId],
        variants: [{ value: currentValue, count: 1 }],
        suggestedOm: row.suggestedOm
          ? {
              id: row.suggestedOm.id,
              code: row.suggestedOm.code,
              name: row.suggestedOm.name,
              uf: row.suggestedOm.uf,
            }
          : null,
        targetReference: row.targetReference,
        confidence: row.confidence ?? null,
        resolutionMethod: row.resolutionMethod ?? null,
        reasoning: row.reasoning ?? null,
        sampleValue: currentValue,
        summary: row.targetReference
          ? `Substituir por ${row.targetReference} para unificar a OM.`
          : 'A IA e a heurística não encontraram OM com segurança suficiente. É necessário escolher manualmente a OM correta.',
      });
    }

    const groups = Array.from(groupsMap.values())
      .map((group) => ({
        ...group,
        variants: [...group.variants].sort(
          (a, b) =>
            b.count - a.count || a.value.localeCompare(b.value, 'pt-BR'),
        ),
      }))
      .sort((a, b) => {
        if (a.status !== b.status)
          return a.status === 'READY_TO_APPLY' ? -1 : 1;
        return b.totalRecords - a.totalRecords;
      });

    const readyGroups = groups.filter(
      (item) => item.status === 'READY_TO_APPLY',
    ).length;
    const unresolvedGroups = groups.filter(
      (item) => item.status === 'NEEDS_MANUAL_SELECTION',
    ).length;
    const readyRecords = groups
      .filter((item) => item.status === 'READY_TO_APPLY')
      .reduce((acc, item) => acc + item.totalRecords, 0);
    const unresolvedRecords = groups
      .filter((item) => item.status === 'NEEDS_MANUAL_SELECTION')
      .reduce((acc, item) => acc + item.totalRecords, 0);

    return {
      sourceType: config.sourceType,
      label: config.label,
      description: config.description,
      supported: true,
      totalGroups: groups.length,
      totalRecords: groups.reduce((acc, item) => acc + item.totalRecords, 0),
      readyGroups,
      readyRecords,
      unresolvedGroups,
      unresolvedRecords,
      groups,
    };
  }

  private async rebuildSource(
    config: SourceConfig,
    omCatalog: OmCatalogItem[],
    localityCatalog: LocalityCatalogItem[],
  ) {
    const resolved = await this.resolveSourceRecords(
      config,
      omCatalog,
      localityCatalog,
    );
    const links: LinkInput[] = resolved.map((item) => ({
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
    }));

    await this.persistLinks(config.sourceType, links);

    return {
      sourceType: config.sourceType,
      label: config.label,
      totalProcessed: links.length,
      matched: links.filter(
        (item) => item.status === BI_NORMALIZATION_STATUSES.MATCHED,
      ).length,
      ufOnly: links.filter(
        (item) => item.status === BI_NORMALIZATION_STATUSES.UF_ONLY,
      ).length,
      notFound: links.filter(
        (item) => item.status === BI_NORMALIZATION_STATUSES.NOT_FOUND,
      ).length,
      notApplicable: links.filter(
        (item) => item.status === BI_NORMALIZATION_STATUSES.NOT_APPLICABLE,
      ).length,
    };
  }

  private async resolveSourceRecords(
    config: SourceConfig,
    omCatalog: OmCatalogItem[],
    localityCatalog: LocalityCatalogItem[],
    onlyRecordIds?: string[],
  ): Promise<ResolvedSourceRecord[]> {
    const recordFilter = onlyRecordIds?.length
      ? { id: { in: onlyRecordIds } }
      : undefined;
    const omSuggestionCache = new Map<string, Promise<SuggestedResolution>>();
    const compositeSuggestionCache = new Map<
      string,
      Promise<SuggestedResolution>
    >();

    switch (config.sourceType) {
      case BI_NORMALIZATION_SOURCE_TYPES.SURVEY_SCHOOLS: {
        const rows = await this.prisma.biSurveyResponse.findMany({
          where: recordFilter,
          select: { id: true, batchId: true, om: true },
        });
        return Promise.all(
          rows.map((row) =>
            this.resolveScalarSourceRecord({
              sourceType: config.sourceType,
              sourceRecordId: row.id,
              sourceBatchId: row.batchId,
              rawReference: row.om,
              fieldKey: 'om',
              fieldLabel: 'OM',
              omCatalog,
              omSuggestionCache,
            }),
          ),
        );
      }
      case BI_NORMALIZATION_SOURCE_TYPES.DOMESTIC_VIOLENCE: {
        const rows = await this.prisma.biDomesticViolenceResponse.findMany({
          where: recordFilter,
          select: { id: true, batchId: true, organization: true },
        });
        return Promise.all(
          rows.map((row) =>
            this.resolveScalarSourceRecord({
              sourceType: config.sourceType,
              sourceRecordId: row.id,
              sourceBatchId: row.batchId,
              rawReference: row.organization,
              fieldKey: 'organization',
              fieldLabel: 'Organização / OM',
              omCatalog,
              omSuggestionCache,
            }),
          ),
        );
      }
      case BI_NORMALIZATION_SOURCE_TYPES.RECRUITS: {
        const rows = await this.prisma.biRecruitsResponse.findMany({
          where: recordFilter,
          select: { id: true, batchId: true },
        });
        return rows.map((row) => ({
          sourceType: config.sourceType,
          sourceRecordId: row.id,
          sourceBatchId: row.batchId,
          status: BI_NORMALIZATION_STATUSES.NOT_APPLICABLE,
          resolutionMethod: 'SOURCE_WITHOUT_ORGANIZATIONAL_KEY',
          targetFieldKey: null,
          targetFieldLabel: null,
          targetFieldSource: 'NONE',
          currentTargetValue: null,
          targetReference: null,
          needsWriteback: false,
          suggestedOm: null,
          matchedInput: null,
        }));
      }
      case BI_NORMALIZATION_SOURCE_TYPES.BEST_PRACTICE_CYCLE: {
        const rows = await this.prisma.biBestPracticeCycleResponse.findMany({
          where: recordFilter,
          select: {
            id: true,
            batchId: true,
            identification: true,
            specialty: true,
          },
        });
        return Promise.all(
          rows.map((row) =>
            this.resolveCompositeSourceRecord({
              sourceType: config.sourceType,
              sourceRecordId: row.id,
              sourceBatchId: row.batchId,
              rawReference: row.identification,
              secondaryReference: row.specialty,
              rawFieldKey: 'identification',
              rawFieldLabel: 'Identificação / OM',
              secondaryFieldKey: 'specialty',
              secondaryFieldLabel: 'Especialidade / apoio',
              omCatalog,
              localityCatalog,
              allowSecondaryOmMatch: false,
              compositeSuggestionCache,
            }),
          ),
        );
      }
      case BI_NORMALIZATION_SOURCE_TYPES.CPCA_MEETING: {
        const rows = await (this.prisma as any).biCpcaMeetingResponse.findMany({
          where: recordFilter,
          select: {
            id: true,
            batchId: true,
            answersJson: true,
            rawPayload: true,
          },
        });
        return Promise.all(
          rows.map((row: any) =>
            this.resolveJsonSourceRecord({
              sourceType: config.sourceType,
              sourceRecordId: String(row.id),
              sourceBatchId: row.batchId ? String(row.batchId) : null,
              answersJson: row.answersJson,
              rawPayload: row.rawPayload,
              omCatalog,
              localityCatalog,
              compositeSuggestionCache,
            }),
          ),
        );
      }
      case BI_NORMALIZATION_SOURCE_TYPES.GSD_EVALUATION: {
        const rows = await (
          this.prisma as any
        ).biGsdEvaluationResponse.findMany({
          where: recordFilter,
          select: {
            id: true,
            batchId: true,
            answersJson: true,
            rawPayload: true,
          },
        });
        return Promise.all(
          rows.map((row: any) =>
            this.resolveJsonSourceRecord({
              sourceType: config.sourceType,
              sourceRecordId: String(row.id),
              sourceBatchId: row.batchId ? String(row.batchId) : null,
              answersJson: row.answersJson,
              rawPayload: row.rawPayload,
              omCatalog,
              localityCatalog,
              compositeSuggestionCache,
            }),
          ),
        );
      }
      default:
        return [];
    }
  }

  private async resolveScalarSourceRecord(args: {
    sourceType: BiNormalizationSourceTypeValue;
    sourceRecordId: string;
    sourceBatchId?: string | null;
    rawReference?: string | null;
    fieldKey: string;
    fieldLabel: string;
    omCatalog: OmCatalogItem[];
    omSuggestionCache: Map<string, Promise<SuggestedResolution>>;
  }): Promise<ResolvedSourceRecord> {
    const rawReference = normalizeDisplayText(args.rawReference);
    const suggestion = await this.resolveOmSuggestionCached(
      rawReference,
      args.omCatalog,
      args.omSuggestionCache,
    );
    return this.buildResolvedSourceRecord({
      sourceType: args.sourceType,
      sourceRecordId: args.sourceRecordId,
      sourceBatchId: args.sourceBatchId,
      rawReference,
      secondaryReference: null,
      currentTargetValue: rawReference,
      targetFieldKey: args.fieldKey,
      targetFieldLabel: args.fieldLabel,
      targetFieldSource: 'SCALAR',
      suggestion,
    });
  }

  private async resolveCompositeSourceRecord(args: {
    sourceType: BiNormalizationSourceTypeValue;
    sourceRecordId: string;
    sourceBatchId?: string | null;
    rawReference?: string | null;
    secondaryReference?: string | null;
    directUf?: string | null;
    rawFieldKey: string;
    rawFieldLabel: string;
    secondaryFieldKey?: string | null;
    secondaryFieldLabel?: string | null;
    omCatalog: OmCatalogItem[];
    localityCatalog: LocalityCatalogItem[];
    allowSecondaryOmMatch: boolean;
    compositeSuggestionCache: Map<string, Promise<SuggestedResolution>>;
  }): Promise<ResolvedSourceRecord> {
    const rawReference = normalizeDisplayText(args.rawReference);
    const secondaryReference = normalizeDisplayText(args.secondaryReference);
    const directUf = normalizeDisplayText(args.directUf);
    const suggestion = await this.resolveCompositeSuggestionCached(
      {
        rawReference,
        secondaryReference,
        directUf,
        allowSecondaryOmMatch: args.allowSecondaryOmMatch,
      },
      args.omCatalog,
      args.localityCatalog,
      args.compositeSuggestionCache,
    );

    const currentTargetValue =
      suggestion.matchedInput === 'secondary'
        ? secondaryReference
        : rawReference;

    return this.buildResolvedSourceRecord({
      sourceType: args.sourceType,
      sourceRecordId: args.sourceRecordId,
      sourceBatchId: args.sourceBatchId,
      rawReference,
      secondaryReference,
      currentTargetValue,
      targetFieldKey:
        suggestion.matchedInput === 'secondary'
          ? (args.secondaryFieldKey ?? null)
          : args.rawFieldKey,
      targetFieldLabel:
        suggestion.matchedInput === 'secondary'
          ? (args.secondaryFieldLabel ?? args.rawFieldLabel)
          : args.rawFieldLabel,
      targetFieldSource: 'SCALAR',
      suggestion,
    });
  }

  private async resolveJsonSourceRecord(args: {
    sourceType: BiNormalizationSourceTypeValue;
    sourceRecordId: string;
    sourceBatchId?: string | null;
    answersJson: Prisma.JsonValue | null | undefined;
    rawPayload: Prisma.JsonValue | null | undefined;
    omCatalog: OmCatalogItem[];
    localityCatalog: LocalityCatalogItem[];
    compositeSuggestionCache: Map<string, Promise<SuggestedResolution>>;
  }): Promise<ResolvedSourceRecord> {
    const candidate = this.extractJsonCandidate(
      args.answersJson,
      args.rawPayload,
    );
    const rawReference = normalizeDisplayText(candidate.rawReference);
    const secondaryReference = normalizeDisplayText(
      candidate.secondaryReference,
    );
    const directUf = normalizeDisplayText(candidate.directUf);
    const suggestion = await this.resolveCompositeSuggestionCached(
      {
        rawReference,
        secondaryReference,
        directUf,
        allowSecondaryOmMatch: true,
      },
      args.omCatalog,
      args.localityCatalog,
      args.compositeSuggestionCache,
    );

    const currentTargetValue =
      suggestion.matchedInput === 'secondary'
        ? secondaryReference
        : rawReference;

    return this.buildResolvedSourceRecord({
      sourceType: args.sourceType,
      sourceRecordId: args.sourceRecordId,
      sourceBatchId: args.sourceBatchId,
      rawReference,
      secondaryReference,
      currentTargetValue,
      targetFieldKey:
        suggestion.matchedInput === 'secondary'
          ? (candidate.secondaryFieldKey ?? null)
          : (candidate.rawFieldKey ?? null),
      targetFieldLabel:
        suggestion.matchedInput === 'secondary'
          ? (candidate.secondaryFieldLabel ??
            candidate.rawFieldLabel ??
            'Campo da pesquisa')
          : (candidate.rawFieldLabel ?? 'Campo da pesquisa'),
      targetFieldSource: 'JSON',
      suggestion,
      answersJson: args.answersJson ?? null,
      rawPayload: args.rawPayload ?? null,
    });
  }

  private buildResolvedSourceRecord(args: {
    sourceType: BiNormalizationSourceTypeValue;
    sourceRecordId: string;
    sourceBatchId?: string | null;
    rawReference?: string | null;
    secondaryReference?: string | null;
    currentTargetValue?: string | null;
    targetFieldKey: string | null;
    targetFieldLabel: string | null;
    targetFieldSource: TargetFieldSource;
    suggestion: SuggestedResolution;
    answersJson?: Prisma.JsonValue | null;
    rawPayload?: Prisma.JsonValue | null;
  }): ResolvedSourceRecord {
    const targetReference = args.suggestion.om?.code ?? null;
    const currentTargetValue = normalizeDisplayText(args.currentTargetValue);
    const needsWriteback = Boolean(
      targetReference &&
      currentTargetValue &&
      currentTargetValue !== targetReference,
    );

    return {
      sourceType: args.sourceType,
      sourceRecordId: args.sourceRecordId,
      sourceBatchId: args.sourceBatchId ?? null,
      rawReference: args.rawReference ?? null,
      secondaryReference: args.secondaryReference ?? null,
      omId: args.suggestion.om?.id ?? null,
      uf: args.suggestion.uf ?? args.suggestion.om?.uf ?? null,
      status: args.suggestion.status,
      confidence: args.suggestion.confidence ?? null,
      resolutionMethod: args.suggestion.resolutionMethod ?? null,
      targetFieldKey: args.targetFieldKey,
      targetFieldLabel: args.targetFieldLabel,
      targetFieldSource: args.targetFieldSource,
      currentTargetValue: currentTargetValue || null,
      targetReference,
      needsWriteback,
      suggestedOm: args.suggestion.om ?? null,
      matchedInput: args.suggestion.matchedInput ?? null,
      reasoning: args.suggestion.reasoning ?? null,
      answersJson: args.answersJson ?? null,
      rawPayload: args.rawPayload ?? null,
    };
  }

  private async resolveOmSuggestionCached(
    rawReference: string,
    omCatalog: OmCatalogItem[],
    cache: Map<string, Promise<SuggestedResolution>>,
  ) {
    const cacheKey = buildAiCacheKey([rawReference]);
    if (!cache.has(cacheKey)) {
      cache.set(cacheKey, this.resolveOmSuggestion(rawReference, omCatalog));
    }
    return cache.get(cacheKey)!;
  }

  private async resolveCompositeSuggestionCached(
    params: {
      rawReference: string;
      secondaryReference: string;
      directUf: string;
      allowSecondaryOmMatch: boolean;
    },
    omCatalog: OmCatalogItem[],
    localityCatalog: LocalityCatalogItem[],
    cache: Map<string, Promise<SuggestedResolution>>,
  ) {
    const cacheKey = buildAiCacheKey([
      params.rawReference,
      params.secondaryReference,
      params.directUf,
      params.allowSecondaryOmMatch ? 'ALLOW_SECONDARY' : 'RAW_ONLY',
    ]);
    if (!cache.has(cacheKey)) {
      cache.set(
        cacheKey,
        this.resolveCompositeSuggestion(params, omCatalog, localityCatalog),
      );
    }
    return cache.get(cacheKey)!;
  }

  private async resolveOmSuggestion(
    rawReference: string,
    omCatalog: OmCatalogItem[],
  ): Promise<SuggestedResolution> {
    const reference = normalizeDisplayText(rawReference);
    if (!reference) {
      return {
        status: BI_NORMALIZATION_STATUSES.NOT_FOUND,
        resolutionMethod: 'EMPTY_REFERENCE',
        matchedInput: 'raw',
      };
    }

    const exactMatch = this.findExactOmMatch(reference, omCatalog);
    if (exactMatch) {
      return {
        status: BI_NORMALIZATION_STATUSES.MATCHED,
        om: exactMatch,
        uf: exactMatch.uf,
        confidence: 1,
        resolutionMethod: 'OM_EXACT_CANONICAL',
        matchedInput: 'raw',
      };
    }

    const rankedCandidates = this.rankOmCandidates(reference, omCatalog);
    const strongHeuristic = rankedCandidates[0];
    const secondCandidate = rankedCandidates[1];
    if (
      strongHeuristic &&
      strongHeuristic.score >= 1500 &&
      (!secondCandidate || strongHeuristic.score - secondCandidate.score >= 120)
    ) {
      return {
        status: BI_NORMALIZATION_STATUSES.MATCHED,
        om: strongHeuristic.row,
        uf: strongHeuristic.row.uf,
        confidence: 0.94,
        resolutionMethod: 'OM_STRONG_HEURISTIC',
        matchedInput: 'raw',
      };
    }

    const aiSuggestion = await this.resolveOmWithAi(
      reference,
      rankedCandidates,
    );
    if (aiSuggestion?.om) {
      return {
        status: BI_NORMALIZATION_STATUSES.MATCHED,
        om: aiSuggestion.om,
        uf: aiSuggestion.om.uf,
        confidence: aiSuggestion.confidence,
        resolutionMethod: 'AI_ASSISTED_OM',
        matchedInput: 'raw',
        reasoning: aiSuggestion.reasoning,
      };
    }

    if (
      strongHeuristic &&
      strongHeuristic.score >= 1350 &&
      (!secondCandidate || strongHeuristic.score - secondCandidate.score >= 180)
    ) {
      return {
        status: BI_NORMALIZATION_STATUSES.MATCHED,
        om: strongHeuristic.row,
        uf: strongHeuristic.row.uf,
        confidence: 0.82,
        resolutionMethod: 'OM_FALLBACK_HEURISTIC',
        matchedInput: 'raw',
      };
    }

    return {
      status: BI_NORMALIZATION_STATUSES.NOT_FOUND,
      resolutionMethod: 'OM_REFERENCE_NOT_RESOLVED',
      matchedInput: 'raw',
    };
  }

  private async resolveCompositeSuggestion(
    params: {
      rawReference: string;
      secondaryReference: string;
      directUf: string;
      allowSecondaryOmMatch: boolean;
    },
    omCatalog: OmCatalogItem[],
    localityCatalog: LocalityCatalogItem[],
  ): Promise<SuggestedResolution> {
    const rawSuggestion = await this.resolveOmSuggestion(
      params.rawReference,
      omCatalog,
    );
    if (
      rawSuggestion.status === BI_NORMALIZATION_STATUSES.MATCHED &&
      rawSuggestion.om
    ) {
      return { ...rawSuggestion, matchedInput: 'raw' };
    }

    if (params.allowSecondaryOmMatch && params.secondaryReference) {
      const secondarySuggestion = await this.resolveOmSuggestion(
        params.secondaryReference,
        omCatalog,
      );
      if (
        secondarySuggestion.status === BI_NORMALIZATION_STATUSES.MATCHED &&
        secondarySuggestion.om
      ) {
        return { ...secondarySuggestion, matchedInput: 'secondary' };
      }
    }

    const localityInput = params.rawReference || params.secondaryReference;
    const matchedLocality = this.matchLocality(localityInput, localityCatalog);
    if (matchedLocality?.uf) {
      return {
        status: BI_NORMALIZATION_STATUSES.UF_ONLY,
        uf: matchedLocality.uf,
        confidence: matchedLocality.confidence,
        resolutionMethod: matchedLocality.method,
        matchedInput: params.rawReference
          ? 'raw'
          : params.secondaryReference
            ? 'secondary'
            : null,
      };
    }

    const directUf = normalizeUfCode(
      params.directUf || params.rawReference || params.secondaryReference,
    );
    if (directUf) {
      return {
        status: BI_NORMALIZATION_STATUSES.UF_ONLY,
        uf: directUf,
        confidence: 0.66,
        resolutionMethod: 'DIRECT_UF',
        matchedInput: params.rawReference
          ? 'raw'
          : params.secondaryReference
            ? 'secondary'
            : null,
      };
    }

    return {
      status: BI_NORMALIZATION_STATUSES.NOT_FOUND,
      resolutionMethod:
        params.rawReference || params.secondaryReference
          ? 'NO_HEURISTIC_MATCH'
          : 'EMPTY_REFERENCE',
      matchedInput: params.rawReference
        ? 'raw'
        : params.secondaryReference
          ? 'secondary'
          : null,
    };
  }

  private findExactOmMatch(reference: string, catalog: OmCatalogItem[]) {
    const normalized = normalizeDisplayText(reference);
    if (!normalized) return null;

    const candidateKeys = Array.from(buildFabOmCandidateSet(normalized))
      .map((candidate) => normalizeKey(candidate))
      .filter(Boolean);
    if (candidateKeys.length === 0) return null;

    for (const candidateKey of candidateKeys) {
      const exactCode = catalog.find((row) => row.codeKey === candidateKey);
      if (exactCode) return exactCode;
      const exactName = catalog.find((row) => row.nameKey === candidateKey);
      if (exactName) return exactName;
      const exactAlias = catalog.find((row) => row.aliasKeys.includes(candidateKey));
      if (exactAlias) return exactAlias;
    }

    return null;
  }

  private rankOmCandidates(reference: string, catalog: OmCatalogItem[]) {
    const normalized = normalizeDisplayText(reference);
    if (!normalized) return [] as Array<{ row: OmCatalogItem; score: number }>;

    const candidateKeys = Array.from(buildFabOmCandidateSet(normalized))
      .map((candidate) => normalizeKey(candidate))
      .filter(Boolean);
    if (candidateKeys.length === 0) return [];

    const scored = new Map<string, { row: OmCatalogItem; score: number }>();
    for (const row of catalog) {
      let bestScore = -1;
      for (const candidateKey of candidateKeys) {
        const score = computeOmScore(
          row.codeKey,
          row.nameKey,
          candidateKey,
          row.aliasKeys,
        );
        if (score > bestScore) bestScore = score;
      }
      if (bestScore < 0) continue;
      scored.set(row.id, { row, score: bestScore });
    }

    return Array.from(scored.values())
      .sort(
        (a, b) =>
          b.score - a.score || a.row.code.localeCompare(b.row.code, 'pt-BR'),
      )
      .slice(0, 12);
  }

  private async resolveOmWithAi(
    rawReference: string,
    rankedCandidates: Array<{ row: OmCatalogItem; score: number }>,
  ): Promise<{
    om: OmCatalogItem | null;
    confidence: number;
    reasoning: string | null;
  } | null> {
    if (!this.litellm?.isConfigured() || rankedCandidates.length === 0)
      return null;

    const compactCandidates = rankedCandidates.slice(0, 8).map((item) => ({
      code: item.row.code,
      name: item.row.name,
      uf: item.row.uf,
      heuristicScore: item.score,
    }));

    const prompt = [
      'Você está normalizando referências textuais de Organizações Militares (OM) da FAB.',
      'Escolha uma OM SOMENTE se a referência bruta claramente apontar para a mesma OM, mesmo que haja diferença de caixa, hífen, espaços, acentos, abreviação ou pontuação.',
      'Nunca invente. Nunca escolha só por cidade ou UF. Se houver dúvida real, retorne matchedCode = null.',
      'Responda APENAS em JSON com o formato {"matchedCode": string|null, "confidence": number, "reason": string}.',
      `Referência bruta: ${rawReference}`,
      `Opções: ${JSON.stringify(compactCandidates)}`,
    ].join('\n');

    try {
      const { content } = await this.litellm.chatCompletion({
        messages: [
          { role: 'system', content: 'Responda apenas JSON válido.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 220,
      });
      const parsed = parseJsonObject(content);
      const matchedCode = normalizeDisplayText(
        parsed?.matchedCode as string | null | undefined,
      );
      if (!matchedCode) return null;
      const chosen = rankedCandidates.find(
        (item) => normalizeFabOm(item.row.code) === normalizeFabOm(matchedCode),
      );
      if (!chosen) return null;
      const confidenceRaw = Number(parsed?.confidence ?? 0);
      const confidence = Number.isFinite(confidenceRaw)
        ? Math.max(0, Math.min(1, confidenceRaw))
        : 0.75;
      return {
        om: chosen.row,
        confidence: confidence || 0.75,
        reasoning:
          normalizeDisplayText(parsed?.reason as string | null | undefined) ||
          null,
      };
    } catch (error) {
      this.logger.warn(
        `Falha ao consultar IA para normalização BI: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private extractJsonCandidate(
    answersJson: Prisma.JsonValue | null | undefined,
    rawPayload: Prisma.JsonValue | null | undefined,
  ): JsonCandidate {
    const entries = [
      ...this.jsonEntries(answersJson, 'answersJson'),
      ...this.jsonEntries(rawPayload, 'rawPayload'),
    ];

    const pickFirst = (predicates: string[]): JsonFieldCandidate => {
      const match = entries.find((entry) => {
        const key = normalizeFabOm(entry.key);
        return predicates.some((token) => key.includes(token));
      });
      return {
        value: normalizeDisplayText(match?.value),
        key: match?.key ?? null,
        label: match?.label ?? null,
      };
    };

    const raw = pickFirst(JSON_OM_KEY_TOKENS);
    const secondary = pickFirst(JSON_SECONDARY_KEY_TOKENS);
    const directUf = pickFirst(JSON_UF_KEY_TOKENS);

    return {
      rawReference: raw.value || null,
      secondaryReference: secondary.value || null,
      directUf: directUf.value || null,
      rawFieldKey: raw.key,
      rawFieldLabel: raw.label,
      secondaryFieldKey: secondary.key,
      secondaryFieldLabel: secondary.label,
    };
  }

  private jsonEntries(
    value: Prisma.JsonValue | null | undefined,
    source: 'answersJson' | 'rawPayload',
  ): JsonEntry[] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    return Object.entries(value as Record<string, unknown>)
      .map(([key, rawValue]) => ({
        key,
        label: stringifyLabel(key),
        value: normalizeDisplayText(rawValue as string | null | undefined),
        source,
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
        ...(ids.length > 0 ? { sourceRecordId: { notIn: ids } } : undefined),
      },
    });

    for (const chunk of this.chunk(links, 200)) {
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

  private buildApplyMutation(
    sourceType: BiNormalizationSourceTypeValue,
    row: ResolvedSourceRecord,
    nextReference: string,
  ): Prisma.PrismaPromise<any> | null {
    if (!row.targetFieldKey || !nextReference) return null;

    switch (sourceType) {
      case BI_NORMALIZATION_SOURCE_TYPES.SURVEY_SCHOOLS:
        return this.prisma.biSurveyResponse.update({
          where: { id: row.sourceRecordId },
          data: { om: nextReference },
        });
      case BI_NORMALIZATION_SOURCE_TYPES.DOMESTIC_VIOLENCE:
        return this.prisma.biDomesticViolenceResponse.update({
          where: { id: row.sourceRecordId },
          data: { organization: nextReference },
        });
      case BI_NORMALIZATION_SOURCE_TYPES.BEST_PRACTICE_CYCLE:
        return this.prisma.biBestPracticeCycleResponse.update({
          where: { id: row.sourceRecordId },
          data: { identification: nextReference },
        });
      case BI_NORMALIZATION_SOURCE_TYPES.CPCA_MEETING:
        return this.buildJsonApplyMutation(
          'biCpcaMeetingResponse',
          row,
          nextReference,
        );
      case BI_NORMALIZATION_SOURCE_TYPES.GSD_EVALUATION:
        return this.buildJsonApplyMutation(
          'biGsdEvaluationResponse',
          row,
          nextReference,
        );
      default:
        return null;
    }
  }

  private buildJsonApplyMutation(
    modelName: 'biCpcaMeetingResponse' | 'biGsdEvaluationResponse',
    row: ResolvedSourceRecord,
    nextReference: string,
  ): Prisma.PrismaPromise<any> | null {
    if (!row.targetFieldKey) return null;
    const model = (this.prisma as any)[modelName];
    const nextAnswersJson = cloneJsonObject(row.answersJson);
    const nextRawPayload = cloneJsonObject(row.rawPayload);
    nextAnswersJson[row.targetFieldKey] = nextReference;
    if (row.targetFieldKey in nextRawPayload) {
      nextRawPayload[row.targetFieldKey] = nextReference;
    }

    return model.update({
      where: { id: row.sourceRecordId },
      data: {
        answersJson: nextAnswersJson as Prisma.InputJsonValue,
        rawPayload: nextRawPayload as Prisma.InputJsonValue,
      },
    }) as Prisma.PrismaPromise<any>;
  }

  private pushSampleRow(
    current: number[] | undefined,
    rowNumber: number,
    limit = 6,
  ) {
    const base = Array.isArray(current) ? [...current] : [];
    if (!Number.isFinite(rowNumber) || base.includes(rowNumber)) return base;
    base.push(rowNumber);
    base.sort((a, b) => a - b);
    return base.slice(0, limit);
  }

  private chooseCanonicalSpecialtyValue(
    variants: Array<{ value: string; count: number }>,
  ) {
    if (!variants.length) return '';
    const ranked = [...variants].sort(
      (a, b) =>
        b.count - a.count || a.value.localeCompare(b.value, 'pt-BR'),
    );
    const preferred = ranked.find(
      (item) =>
        collapseImportWhitespace(item.value) ===
        buildCanonicalSpecialtyValue(item.value),
    );
    return buildCanonicalSpecialtyValue(preferred?.value ?? ranked[0]?.value ?? '');
  }

  private async loadOmCatalog(): Promise<OmCatalogItem[]> {
    const items = await this.prisma.om.findMany({
      select: { id: true, code: true, name: true, uf: true },
    });
    return items.map((item) => ({
      ...item,
      codeKey: normalizeKey(item.code),
      nameKey: normalizeKey(item.name),
      aliasKeys: Array.from(buildFabOmRowAliasSet(item.code, item.name))
        .map((candidate) => normalizeKey(candidate))
        .filter(
          (candidate, index, values) =>
            Boolean(candidate) &&
            candidate !== normalizeKey(item.code) &&
            candidate !== normalizeKey(item.name) &&
            values.indexOf(candidate) === index,
        ),
    }));
  }

  private async loadLocalityCatalog(): Promise<LocalityCatalogItem[]> {
    const items = await this.prisma.locality.findMany({
      select: { id: true, code: true, name: true, uf: true },
    });
    return items.map((item) => ({
      ...item,
      codeKey: normalizeKey(item.code),
      nameKey: normalizeKey(item.name),
    }));
  }

  private matchLocality(reference: string, catalog: LocalityCatalogItem[]) {
    const normalized = normalizeDisplayText(reference);
    if (!normalized) return null;
    const candidateKey = normalizeKey(normalized);
    if (!candidateKey) return null;

    let best: LocalityCatalogItem | null = null;
    let bestScore = -1;
    for (const row of catalog) {
      const score = computeLocalityScore(
        row.codeKey,
        row.nameKey,
        candidateKey,
      );
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

  private chunk<T>(values: T[], size: number) {
    const result: T[][] = [];
    for (let index = 0; index < values.length; index += size) {
      result.push(values.slice(index, index + size));
    }
    return result;
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
