import fs from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';
import * as XLSX from 'xlsx';
import type { CreateCpcaCaseDto } from '../src/cpca/dto/create-cpca-case.dto';
import { PrismaService } from '../src/prisma/prisma.service';

config({ path: path.join(__dirname, '..', '.env') });

type Args = {
  filePath: string;
  apply: boolean;
  reportPath: string | null;
};

type CsvRow = Record<string, unknown>;

type OmRow = {
  id: string;
  code: string;
  name: string;
  uf: string | null;
  hasCpca: boolean;
};

type ImportIssue = {
  rowNumber: number;
  om: string;
  field: string;
  value: string;
  reason: string;
};

type PreparedCase = {
  rowNumber: number;
  rawOm: string;
  om: OmRow;
  payload: CreateCpcaCaseDto;
  signature: string;
  reportedAt: Date | null;
  targetStatus: 'RECEIVED' | 'PROTECTION_MEASURES' | 'PRELIMINARY_ANALYSIS' | 'PROCEDURE_DEFINED' | 'INVESTIGATION' | 'CONCLUDED' | 'ARCHIVED';
  targetArchivedAt: Date | null;
  issues: ImportIssue[];
};

type CpcaProcedureTypeValue = NonNullable<CreateCpcaCaseDto['procedureType']>;
type CpcaAgeRangeValue = NonNullable<CreateCpcaCaseDto['aggressorAgeRange']>;

type ExistingCaseSignatureInput = {
  omId: string | null | undefined;
  complaintType: string | null | undefined;
  detailedViolenceType: string | null | undefined;
  incidentDate: Date | null | undefined;
  reportedAt: Date | null | undefined;
  harassmentContext: string | null | undefined;
  occurrenceLocation: string | null | undefined;
  aggressorRank: string | null | undefined;
  aggressorGender: string | null | undefined;
  aggressorAgeRange: string | null | undefined;
  victimRank: string | null | undefined;
  victimGender: string | null | undefined;
  victimAgeRange: string | null | undefined;
  notifierType: string | null | undefined;
  incidentFrequency: string | null | undefined;
  hierarchicalFunctionalRelation: string | null | undefined;
  occurrenceForm: string | null | undefined;
  procedureType: string | null | undefined;
  administrativeProcedure: string | null | undefined;
  procedureCurrentSituation: string | null | undefined;
  psychologicalSupportProvided: boolean | null | undefined;
  legalSupportProvided: boolean | null | undefined;
  socialSupportProvided: boolean | null | undefined;
  retaliationReported: string | null | undefined;
  retaliationAgainst: string | null | undefined;
  retaliationNotes: string | null | undefined;
  procedureNotes: string | null | undefined;
};

type EnumMapping = {
  value: string | null;
  issue?: string;
  preserveRaw?: boolean;
};

type PatternDefinition = {
  value: string;
  patterns: string[];
};

const DEFAULT_FILE =
  '/home/italoibsc/Downloads/Mensuração Estatística Assédio Moral e Sexual COMAER(1).xlsm - COMPILADOS.csv';

const FIELD_OM = 'OM';
const FIELD_TYPE = 'Tipo de Assédio ou Violência';
const FIELD_CONTEXT = 'Contexto do assédio';
const FIELD_LOCATION = 'Local da ocorrência';
const FIELD_AGGRESSOR_AGE = 'Classificação etária do acusado';
const FIELD_VICTIM_AGE = 'Classificação etária da vítima e/ou noticiante';
const FIELD_AGGRESSOR_GENDER = 'Sexo do acusado';
const FIELD_VICTIM_GENDER = 'Sexo da vítima e/ou noticiante';
const FIELD_FREQUENCY = 'Frequência dos fatos ';
const FIELD_RELATION =
  'Relação hierárquica/funcional do acusado com a vítima e/ou noticiante';
const FIELD_OCCURRENCE_FORM = 'Forma de ocorrência';
const FIELD_ADMIN_PROCEDURE = 'Procedimento administrativo';
const FIELD_PROCEDURE_SITUATION = 'Situação atual  do Procedimento';
const FIELD_SUPPORT_PSYCHO =
  'Suporte Psicológico utilizado pela vítima e/ou noticiante';
const FIELD_SUPPORT_LEGAL =
  'Suporte Jurídico utilizado pela vítima e/ou noticiante';
const FIELD_SUPPORT_RELIGIOUS =
  'Suporte Religioso utilizado pela vítima e/ou noticiante';
const FIELD_SUPPORT_SOCIAL =
  'Suporte de Assistência Social utilizado pela vítima e/ou noticiante';
const FIELD_RETALIATION_REPORTED = 'Houve relatos de retaliação?';
const FIELD_RETALIATION_AGAINST = 'Ocorreu retaliação contra quem?';
const FIELD_INCIDENT_DATE = 'Data do início da ocorrência';
const FIELD_REPORTED_DATE = 'Data da notificação';
const FIELD_NOTES = 'Observações';

const OCCURRENCE_CONTEXT_PATTERNS: PatternDefinition[] = [
  { value: 'PRESENCIAL', patterns: ['PRESENCIAL'] },
  { value: 'VIRTUAL', patterns: ['VIRTUAL'] },
];

const OCCURRENCE_LOCATION_PATTERNS: PatternDefinition[] = [
  { value: 'INTERIOR_OM', patterns: ['INTERIOR DA OM'] },
  {
    value: 'EVENTO_EXTERNO_RELACIONADO_TRABALHO',
    patterns: ['EVENTOS EXTERNOS RELACIONADOS AO TRABALHO'],
  },
  {
    value: 'EVENTO_EXTERNO_NAO_RELACIONADO_TRABALHO',
    patterns: ['EVENTOS EXTERNOS NAO RELACIONADOS AO TRABALHO'],
  },
  { value: 'AMBIENTE_PESSOAL', patterns: ['AMBIENTE PESSOAL'] },
  { value: 'VIA_PUBLICA', patterns: ['VIA PUBLICA'] },
  { value: 'TRANSPORTE_PUBLICO', patterns: ['TRANSPORTE PUBLICO'] },
  {
    value: 'TRANSPORTE_INSTITUCIONAL',
    patterns: ['TRANSPORTE INSTITUCIONAL'],
  },
  { value: 'RESIDENCIA_ACUSADOR', patterns: ['RESIDENCIA DO ACUSADOR'] },
  {
    value: 'APLICATIVOS_MENSAGERIA',
    patterns: [
      'APLICATIVO DE MENSAGENS',
      'APLICATIVOS DE MENSAGENS INSTANTANEAS',
    ],
  },
  { value: 'EMAIL', patterns: ['E MAIL', 'EMAIL'] },
  {
    value: 'REUNIAO_ONLINE_TRABALHO',
    patterns: ['REUNIAO ONLINE DE TRABALHO', 'REUNIAO ONLINE'],
  },
  { value: 'REDES_SOCIAIS', patterns: ['REDES SOCIAIS'] },
  {
    value: 'RESIDENCIA_VITIMA_NOTICIANTE',
    patterns: ['RESIDENCIA DA VITIMA'],
  },
];

const RELATION_PATTERNS: PatternDefinition[] = [
  { value: 'SUPERIOR_HIERARQUICO', patterns: ['SUPERIOR HIERARQUICO', 'SUPERIOR EM POSTO DE SERVICO'] },
  { value: 'CHEFE_IMEDIATO', patterns: ['CHEFE IMEDIATO'] },
  { value: 'SUBORDINADO', patterns: ['SUBORDINADO'] },
  { value: 'MESMA_GRADUACAO', patterns: ['MESMA GRADUACAO'] },
  { value: 'INSTRUTOR_PROFESSOR', patterns: ['INSTRUTOR/PROFESSOR', 'INSTRUTOR PROFESSOR'] },
  { value: 'PRESTADOR_SERVICO', patterns: ['PRESTADOR DE SERVICO'] },
  { value: 'CONJUGE', patterns: ['CONJUGE'] },
  { value: 'OUTROS', patterns: ['OUTROS'] },
  { value: 'CIVIL', patterns: ['CIVIL'] },
];

const OCCURRENCE_FORM_PATTERNS: PatternDefinition[] = [
  { value: 'HUMILHACAO_PUBLICA', patterns: ['HUMILHACAO PUBLICA'] },
  { value: 'EXCLUSAO_ISOLAMENTO', patterns: ['EXCLUSAO/ISOLAMENTO', 'EXCLUSAO ISOLAMENTO'] },
  { value: 'AMEACAS_INTIMIDACAO', patterns: ['AMEACAS/INTIMIDACAO', 'AMEACAS INTIMIDACAO'] },
  { value: 'CRITICAS_EXCESSIVAS', patterns: ['CRITICAS EXCESSIVAS'] },
  { value: 'INJUSTICAS', patterns: ['INJUSTICAS'] },
  { value: 'COMENTARIOS_SEXISTAS', patterns: ['COMENTARIOS SEXISTAS'] },
  { value: 'CONTATO_FISICO_INDESEJADO', patterns: ['CONTATO FISICO INDESEJADO'] },
  {
    value: 'TENTATIVA_CONTATO_FISICO_INDEVIDO',
    patterns: ['TENTATIVA DE CONTATO FISICO INDEVIDO', 'TENTATIVA CONTATO FISICO INDEVIDO'],
  },
  {
    value: 'CHANTAGEM_INTIMIDACAO_FAVOR_SEXUAL',
    patterns: [
      'CHANTAGEM OU INTIMIDACAO PARA OBTER FAVORES SEXUAIS',
      'CHANTAGEM OU INTIMIDACAO PARA OBTER FAVOR SEXUAL',
    ],
  },
  { value: 'VIOLENCIA_FISICA', patterns: ['VIOLENCIA FISICA'] },
  { value: 'VIOLENCIA_PSICOLOGICA', patterns: ['VIOLENCIA PSICOLOGICA'] },
  { value: 'VIOLENCIA_PATRIMONIAL', patterns: ['VIOLENCIA PATRIMONIAL'] },
  { value: 'OUTROS', patterns: ['OUTROS'] },
  { value: 'VIOLENCIA_SEXUAL', patterns: ['VIOLENCIA SEXUAL'] },
  { value: 'VIOLENCIA_MORAL', patterns: ['VIOLENCIA MORAL'] },
  { value: 'VIGILANCIA_EXCESSIVA', patterns: ['VIGILANCIA EXCESSIVA'] },
  {
    value: 'EXIBICAO_MATERIAL_PORNOGRAFICO',
    patterns: ['EXIBICAO DE MATERIAL PORNOGRAFICO'],
  },
];

const ADMIN_PROCEDURE_PATTERNS: PatternDefinition[] = [
  { value: 'IPM', patterns: ['IPM'] },
  { value: 'NAO_HOUVE', patterns: ['NAO HOUVE'] },
  { value: 'SINDICANCIA', patterns: ['SINDICANCIA'] },
  { value: 'NOTICIA_FATO', patterns: ['NOTICIA DE FATO'] },
  { value: 'PATD', patterns: ['PATD'] },
  { value: 'CONSELHO_DISCIPLINA', patterns: ['CONSELHO DE DISCIPLINA'] },
  { value: 'BOLETIM_OCORRENCIA', patterns: ['BOLETIM DE OCORRENCIA'] },
  { value: 'PAD', patterns: ['PAD'] },
  { value: 'APF', patterns: ['APF'] },
  { value: 'INQUERITO_CIVIL', patterns: ['INQUERITO CIVIL'] },
  { value: 'INQUERITO_POLICIAL_COMUM', patterns: ['INQUERITO POLICIAL COMUM'] },
  { value: 'CONSELHO_JUSTIFICACAO', patterns: ['CONSELHO DE JUSTIFICACAO'] },
];

const PROCEDURE_SITUATION_PATTERNS: PatternDefinition[] = [
  { value: 'EM_ANDAMENTO', patterns: ['EM ANDAMENTO'] },
  { value: 'MEDIDA_DISCIPLINAR_APLICADA', patterns: ['MEDIDA DISCIPLINAR APLICADA'] },
  { value: 'OFERECIDA_DENUNCIA', patterns: ['OFERECIDA A DENUNCIA'] },
  { value: 'ARQUIVADO_PELA_JUSTICA', patterns: ['ARQUIVADO PELA JUSTICA'] },
  { value: 'CONDENADO_PELA_JUSTICA', patterns: ['CONDENADO PELA JUSTICA'] },
  { value: 'TRANSFERENCIA_ACUSADO', patterns: ['TRANSFERENCIA DO ACUSADO'] },
  { value: 'TRANSFERENCIA_ACUSADOR', patterns: ['TRANSFERENCIA DO ACUSADOR'] },
  { value: 'MEDIDA_PROTETIVA', patterns: ['MEDIDA PROTETIVA'] },
  { value: 'OUTROS', patterns: ['OUTROS'] },
  { value: 'NAO_APLICAVEL', patterns: ['NAO APLICAVEL'] },
];

const RETALIATION_AGAINST_PATTERNS: PatternDefinition[] = [
  { value: 'VITIMA', patterns: ['VITIMA', 'DENUNCIANTE'] },
  { value: 'TESTEMUNHAS', patterns: ['TESTEMUNHAS'] },
  { value: 'SINDICANTE', patterns: ['SINDICANTE'] },
  { value: 'ENCARREGADO_INQUERITO', patterns: ['ENCARREGADO DE INQUERITO', 'ENCARREGADO INQUERITO'] },
  { value: 'NAO_OCORREU_RETALIACAO', patterns: ['NAO OCORREU RETALIACAO', 'NAO'] },
];

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const fileArgIndex = args.findIndex((item) => item === '--file');
  const reportArgIndex = args.findIndex((item) => item === '--report');
  return {
    filePath:
      fileArgIndex >= 0 && args[fileArgIndex + 1]
        ? args[fileArgIndex + 1]
        : DEFAULT_FILE,
    apply: args.includes('--apply'),
    reportPath:
      reportArgIndex >= 0 && args[reportArgIndex + 1]
        ? args[reportArgIndex + 1]
        : null,
  };
}

function normalizeFabOm(value: string | null | undefined) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function normalizeLabel(value: string | null | undefined) {
  return normalizeFabOm(value)
    .replace(/\s+/g, ' ')
    .trim();
}

function compactKey(value: string | null | undefined) {
  return normalizeLabel(value).replace(/[^A-Z0-9]/g, '');
}

function trimCell(value: unknown) {
  return String(value ?? '').trim();
}

function toDateOnlyIso(value: Date | null | undefined) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  return value.toISOString().slice(0, 10);
}

function toSignature(input: ExistingCaseSignatureInput) {
  return JSON.stringify({
    omId: String(input.omId ?? ''),
    complaintType: String(input.complaintType ?? ''),
    detailedViolenceType: String(input.detailedViolenceType ?? ''),
    incidentDate: toDateOnlyIso(input.incidentDate),
    reportedAt: toDateOnlyIso(input.reportedAt),
    harassmentContext: String(input.harassmentContext ?? ''),
    occurrenceLocation: String(input.occurrenceLocation ?? ''),
    aggressorRank: String(input.aggressorRank ?? ''),
    aggressorGender: String(input.aggressorGender ?? ''),
    aggressorAgeRange: String(input.aggressorAgeRange ?? ''),
    victimRank: String(input.victimRank ?? ''),
    victimGender: String(input.victimGender ?? ''),
    victimAgeRange: String(input.victimAgeRange ?? ''),
    notifierType: String(input.notifierType ?? ''),
    incidentFrequency: String(input.incidentFrequency ?? ''),
    hierarchicalFunctionalRelation: String(
      input.hierarchicalFunctionalRelation ?? '',
    ),
    occurrenceForm: String(input.occurrenceForm ?? ''),
    procedureType: String(input.procedureType ?? ''),
    administrativeProcedure: String(input.administrativeProcedure ?? ''),
    procedureCurrentSituation: String(input.procedureCurrentSituation ?? ''),
    psychologicalSupportProvided: Boolean(input.psychologicalSupportProvided),
    legalSupportProvided: Boolean(input.legalSupportProvided),
    socialSupportProvided: Boolean(input.socialSupportProvided),
    retaliationReported: String(input.retaliationReported ?? ''),
    retaliationAgainst: String(input.retaliationAgainst ?? ''),
    retaliationNotes: String(input.retaliationNotes ?? ''),
    procedureNotes: String(input.procedureNotes ?? ''),
  });
}

function parseBooleanFlag(value: string) {
  const normalized = normalizeLabel(value);
  if (!normalized) return false;
  if (normalized === 'SIM') return true;
  if (normalized === 'NAO') return false;
  return false;
}

function parseDateCell(raw: unknown): Date | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed?.y && parsed?.m && parsed?.d) {
      return new Date(
        Date.UTC(parsed.y, parsed.m - 1, parsed.d, 12, 0, 0),
      );
    }
  }
  const normalized = normalizeLabel(
    raw == null ? null : typeof raw === 'string' ? raw : String(raw),
  );
  if (!normalized || normalized === 'NAO INFORMADO') return null;
  const match = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const first = Number(match[1]);
  const second = Number(match[2]);
  const year = Number(match[3]);
  let month = first;
  let day = second;
  if (first > 12 && second <= 12) {
    day = first;
    month = second;
  }
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function mapGender(raw: string, issues: ImportIssue[], rowNumber: number, om: string, field: string) {
  const normalized = normalizeLabel(raw);
  if (!normalized || normalized === 'ANONIMO' || normalized === 'NAO INFORMADO') {
    return 'NAO_INFORMADO' as const;
  }
  if (normalized === 'MASCULINO') return 'MASCULINO' as const;
  if (normalized === 'FEMININO') return 'FEMININO' as const;
  issues.push({
    rowNumber,
    om,
    field,
    value: raw,
    reason: 'valor inválido; salvo como NAO_INFORMADO',
  });
  return 'NAO_INFORMADO' as const;
}

function mapAgeRange(raw: string): EnumMapping {
  const normalized = normalizeLabel(raw);
  if (!normalized || normalized === 'ANONIMO' || normalized === 'NAO INFORMADO') {
    return { value: null };
  }
  const mapping: Record<string, string> = {
    '19 A 25 ANOS': '19_25',
    '26 A 30 ANOS': '26_30',
    '31 A 35 ANOS': '31_35',
    '36 A 40 ANOS': '36_40',
    '41 A 45 ANOS': '41_45',
    '46 A 50 ANOS': '46_50',
    '51 A 55 ANOS': '51_55',
    'MAIS DE 55 ANOS': 'MAIOR_55',
  };
  const direct = mapping[normalized];
  if (direct) return { value: direct };
  return { value: null, issue: 'faixa etária não mapeada no select', preserveRaw: true };
}

function mapFrequency(raw: string): EnumMapping {
  const normalized = normalizeLabel(raw);
  if (!normalized) return { value: null };
  const mapping: Record<string, string> = {
    'UMA VEZ': 'UMA_VEZ',
    'DUAS VEZES': 'DUAS_VEZES',
    'TRES VEZES': 'TRES_VEZES',
    'QUATRO VEZES': 'QUATRO_VEZES',
    'CINCO VEZES': 'CINCO_VEZES',
    'MAIOR QUE CINCO VEZES': 'MAIOR_CINCO',
  };
  const direct = mapping[normalized];
  if (direct) return { value: direct };
  return { value: null, issue: 'frequência não mapeada no select', preserveRaw: true };
}

function mapSingleSelect(raw: string, patterns: PatternDefinition[]): EnumMapping {
  const normalized = normalizeLabel(raw);
  if (!normalized) return { value: null };
  const matched = Array.from(
    new Set(
      patterns
        .filter((definition) =>
          definition.patterns.some((pattern) => normalized.includes(pattern)),
        )
        .map((definition) => definition.value),
    ),
  );
  if (matched.length === 1) {
    return { value: matched[0] };
  }
  if (matched.length > 1) {
    return {
      value: null,
      issue: 'valor múltiplo não representável em um único select',
      preserveRaw: true,
    };
  }
  return { value: null, issue: 'valor não mapeado no select', preserveRaw: true };
}

function mapViolenceType(raw: string): {
  complaintType: 'MORAL' | 'SEXUAL';
  detailedViolenceType: string;
  note?: string;
  issue?: string;
} | null {
  const normalized = normalizeLabel(raw);
  if (!normalized) return null;
  if (normalized === 'ASSEDIO MORAL') {
    return { complaintType: 'MORAL', detailedViolenceType: 'ASSEDIO_MORAL' };
  }
  if (normalized === 'ASSEDIO SEXUAL') {
    return { complaintType: 'SEXUAL', detailedViolenceType: 'ASSEDIO_SEXUAL' };
  }
  if (normalized === 'VIOLENCIA DOMESTICA - PSICOLOGICA') {
    return {
      complaintType: 'MORAL',
      detailedViolenceType: 'VIOLENCIA_DOMESTICA_PSICOLOGICA',
    };
  }
  if (normalized === 'ASSEDIO SEXUAL E MORAL') {
    return {
      complaintType: 'SEXUAL',
      detailedViolenceType: 'ASSEDIO_SEXUAL',
      issue:
        'tipo combinado; o sistema aceita só uma classificação principal. O valor original foi preservado nas observações do procedimento.',
      note: `Tipo original da planilha: ${raw}`,
    };
  }
  return null;
}

function mapRetaliationReported(raw: string): EnumMapping {
  const normalized = normalizeLabel(raw);
  if (!normalized) return { value: 'NAO_INFORMADO' };
  if (['SIM'].includes(normalized)) return { value: 'SIM' };
  if (['NAO', 'NAO HOUVE RETALIACAO'].includes(normalized)) {
    return { value: 'NAO' };
  }
  if (normalized === 'NAO INFORMADO') return { value: 'NAO_INFORMADO' };
  return { value: 'NAO_INFORMADO', issue: 'valor inválido; salvo como NAO_INFORMADO', preserveRaw: true };
}

function buildProcedureNotes(lines: string[]) {
  const content = lines
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .join('\n');
  return content || null;
}

function resolveOm(rawOm: string, lookups: { byCode: Map<string, OmRow[]>; byName: Map<string, OmRow[]> }) {
  const codeMatches = lookups.byCode.get(compactKey(rawOm)) ?? [];
  if (codeMatches.length === 1) return codeMatches[0];
  const nameMatches = lookups.byName.get(compactKey(rawOm)) ?? [];
  if (nameMatches.length === 1) return nameMatches[0];
  return null;
}

function buildOmLookups(oms: OmRow[]) {
  const byCode = new Map<string, OmRow[]>();
  const byName = new Map<string, OmRow[]>();
  for (const om of oms) {
    const codeKey = compactKey(om.code);
    const nameKey = compactKey(om.name);
    if (codeKey) {
      byCode.set(codeKey, [...(byCode.get(codeKey) ?? []), om]);
    }
    if (nameKey) {
      byName.set(nameKey, [...(byName.get(nameKey) ?? []), om]);
    }
  }
  return { byCode, byName };
}

function deriveTargetStatus(
  mappedSituation: string | null,
  rawSituation: string,
  mappedProcedureType: string,
): PreparedCase['targetStatus'] {
  const normalizedSituation = normalizeLabel(rawSituation);
  if (
    mappedSituation === 'ARQUIVADO_PELA_JUSTICA' ||
    normalizedSituation === 'ARQUIVADO'
  ) {
    return 'ARCHIVED';
  }
  if (
    ['MEDIDA_DISCIPLINAR_APLICADA', 'OFERECIDA_DENUNCIA', 'TRANSFERENCIA_ACUSADO', 'TRANSFERENCIA_ACUSADOR', 'CONDENADO_PELA_JUSTICA'].includes(
      String(mappedSituation ?? ''),
    ) || normalizedSituation.startsWith('CONCLUIDO')
  ) {
    return 'CONCLUDED';
  }
  if (
    mappedSituation === 'EM_ANDAMENTO' ||
    mappedSituation === 'MEDIDA_PROTETIVA' ||
    normalizedSituation.includes('EM ANDAMENTO')
  ) {
    return 'INVESTIGATION';
  }
  if (mappedProcedureType && mappedProcedureType !== 'NOT_DEFINED') {
    return 'PROCEDURE_DEFINED';
  }
  return 'RECEIVED';
}

function deriveCreateStatus(targetStatus: PreparedCase['targetStatus'], procedureType: string) {
  if (targetStatus === 'CONCLUDED' || targetStatus === 'ARCHIVED') {
    return procedureType !== 'NOT_DEFINED' ? 'PROCEDURE_DEFINED' : 'RECEIVED';
  }
  return targetStatus;
}

function normalizeCaseNumberLocalityToken(localityCode: string) {
  return (
    String(localityCode || 'OM')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 6) || 'OM'
  );
}

async function generateCaseNumber(prisma: PrismaService, localityCode: string) {
  const year = new Date().getUTCFullYear();
  const localityToken = normalizeCaseNumberLocalityToken(localityCode);
  const prefix = `CPCA-${year}-${localityToken}-`;
  const pattern = new RegExp(`^${prefix}(\\d{5})$`);
  const existing = await prisma.cpcComplaintCase.findMany({
    where: {
      workflowScope: 'CPCA',
      caseNumber: { startsWith: prefix },
    },
    select: { caseNumber: true },
  });

  let maxSequence = 0;
  for (const item of existing) {
    const match = pattern.exec(String(item.caseNumber ?? ''));
    if (!match) continue;
    const value = Number.parseInt(match[1], 10);
    if (Number.isFinite(value) && value > maxSequence) {
      maxSequence = value;
    }
  }

  return `${prefix}${String(maxSequence + 1).padStart(5, '0')}`;
}

function prepareCase(
  row: CsvRow,
  rowNumber: number,
  om: OmRow,
): PreparedCase | null {
  const rawOm = trimCell(row[FIELD_OM]);
  const issues: ImportIssue[] = [];
  const noteLines: string[] = [];
  const retaliationNoteLines: string[] = [];

  const violenceType = mapViolenceType(trimCell(row[FIELD_TYPE]));
  if (!violenceType) {
    issues.push({
      rowNumber,
      om: rawOm,
      field: FIELD_TYPE,
      value: trimCell(row[FIELD_TYPE]),
      reason: 'tipo de assédio/violência não mapeado',
    });
    return null;
  }
  if (violenceType.issue) {
    issues.push({
      rowNumber,
      om: rawOm,
      field: FIELD_TYPE,
      value: trimCell(row[FIELD_TYPE]),
      reason: violenceType.issue,
    });
  }
  if (violenceType.note) noteLines.push(violenceType.note);

  const context = mapSingleSelect(trimCell(row[FIELD_CONTEXT]), OCCURRENCE_CONTEXT_PATTERNS);
  if (context.issue) {
    issues.push({
      rowNumber,
      om: rawOm,
      field: FIELD_CONTEXT,
      value: trimCell(row[FIELD_CONTEXT]),
      reason: context.issue,
    });
    if (context.preserveRaw) {
      noteLines.push(`Contexto original da planilha: ${trimCell(row[FIELD_CONTEXT])}`);
    }
  }

  const occurrenceLocation = mapSingleSelect(
    trimCell(row[FIELD_LOCATION]),
    OCCURRENCE_LOCATION_PATTERNS,
  );
  if (occurrenceLocation.issue) {
    issues.push({
      rowNumber,
      om: rawOm,
      field: FIELD_LOCATION,
      value: trimCell(row[FIELD_LOCATION]),
      reason: occurrenceLocation.issue,
    });
    if (occurrenceLocation.preserveRaw) {
      noteLines.push(`Local original da planilha: ${trimCell(row[FIELD_LOCATION])}`);
    }
  }

  const aggressorAgeRange = mapAgeRange(trimCell(row[FIELD_AGGRESSOR_AGE]));
  if (aggressorAgeRange.issue) {
    issues.push({
      rowNumber,
      om: rawOm,
      field: FIELD_AGGRESSOR_AGE,
      value: trimCell(row[FIELD_AGGRESSOR_AGE]),
      reason: aggressorAgeRange.issue,
    });
  }

  const victimAgeRange = mapAgeRange(trimCell(row[FIELD_VICTIM_AGE]));
  if (victimAgeRange.issue) {
    issues.push({
      rowNumber,
      om: rawOm,
      field: FIELD_VICTIM_AGE,
      value: trimCell(row[FIELD_VICTIM_AGE]),
      reason: victimAgeRange.issue,
    });
  }

  const aggressorGender = mapGender(
    trimCell(row[FIELD_AGGRESSOR_GENDER]),
    issues,
    rowNumber,
    rawOm,
    FIELD_AGGRESSOR_GENDER,
  );
  const victimGender = mapGender(
    trimCell(row[FIELD_VICTIM_GENDER]),
    issues,
    rowNumber,
    rawOm,
    FIELD_VICTIM_GENDER,
  );

  const incidentFrequency = mapFrequency(trimCell(row[FIELD_FREQUENCY]));
  if (incidentFrequency.issue) {
    issues.push({
      rowNumber,
      om: rawOm,
      field: FIELD_FREQUENCY,
      value: trimCell(row[FIELD_FREQUENCY]),
      reason: incidentFrequency.issue,
    });
  }

  const relation = mapSingleSelect(trimCell(row[FIELD_RELATION]), RELATION_PATTERNS);
  if (relation.issue) {
    issues.push({
      rowNumber,
      om: rawOm,
      field: FIELD_RELATION,
      value: trimCell(row[FIELD_RELATION]),
      reason: relation.issue,
    });
    if (relation.preserveRaw) {
      noteLines.push(`Relação hierárquica/funcional original: ${trimCell(row[FIELD_RELATION])}`);
    }
  }

  const occurrenceForm = mapSingleSelect(
    trimCell(row[FIELD_OCCURRENCE_FORM]),
    OCCURRENCE_FORM_PATTERNS,
  );
  if (occurrenceForm.issue) {
    issues.push({
      rowNumber,
      om: rawOm,
      field: FIELD_OCCURRENCE_FORM,
      value: trimCell(row[FIELD_OCCURRENCE_FORM]),
      reason: occurrenceForm.issue,
    });
    if (occurrenceForm.preserveRaw) {
      noteLines.push(`Forma de ocorrência original: ${trimCell(row[FIELD_OCCURRENCE_FORM])}`);
    }
  }

  const administrativeProcedure = mapSingleSelect(
    trimCell(row[FIELD_ADMIN_PROCEDURE]),
    ADMIN_PROCEDURE_PATTERNS,
  );
  if (administrativeProcedure.issue) {
    issues.push({
      rowNumber,
      om: rawOm,
      field: FIELD_ADMIN_PROCEDURE,
      value: trimCell(row[FIELD_ADMIN_PROCEDURE]),
      reason: administrativeProcedure.issue,
    });
    if (administrativeProcedure.preserveRaw) {
      noteLines.push(
        `Procedimento administrativo original: ${trimCell(row[FIELD_ADMIN_PROCEDURE])}`,
      );
    }
  }

  const procedureSituation = mapSingleSelect(
    trimCell(row[FIELD_PROCEDURE_SITUATION]),
    PROCEDURE_SITUATION_PATTERNS,
  );
  if (procedureSituation.issue) {
    issues.push({
      rowNumber,
      om: rawOm,
      field: FIELD_PROCEDURE_SITUATION,
      value: trimCell(row[FIELD_PROCEDURE_SITUATION]),
      reason: procedureSituation.issue,
    });
    if (procedureSituation.preserveRaw) {
      noteLines.push(
        `Situação atual do procedimento original: ${trimCell(row[FIELD_PROCEDURE_SITUATION])}`,
      );
    }
  }

  const retaliationReported = mapRetaliationReported(
    trimCell(row[FIELD_RETALIATION_REPORTED]),
  );
  if (retaliationReported.issue) {
    issues.push({
      rowNumber,
      om: rawOm,
      field: FIELD_RETALIATION_REPORTED,
      value: trimCell(row[FIELD_RETALIATION_REPORTED]),
      reason: retaliationReported.issue,
    });
    if (retaliationReported.preserveRaw) {
      retaliationNoteLines.push(
        `Valor original sobre relato de retaliação: ${trimCell(row[FIELD_RETALIATION_REPORTED])}`,
      );
    }
  }

  const retaliationAgainst = mapSingleSelect(
    trimCell(row[FIELD_RETALIATION_AGAINST]),
    RETALIATION_AGAINST_PATTERNS,
  );
  if (retaliationAgainst.issue) {
    issues.push({
      rowNumber,
      om: rawOm,
      field: FIELD_RETALIATION_AGAINST,
      value: trimCell(row[FIELD_RETALIATION_AGAINST]),
      reason: retaliationAgainst.issue,
    });
    if (retaliationAgainst.preserveRaw) {
      retaliationNoteLines.push(
        `Alvo original da retaliação: ${trimCell(row[FIELD_RETALIATION_AGAINST])}`,
      );
    }
  }

  const incidentDateRaw = trimCell(row[FIELD_INCIDENT_DATE]);
  const incidentDate = parseDateCell(row[FIELD_INCIDENT_DATE]);
  if (
    incidentDateRaw &&
    normalizeLabel(incidentDateRaw) !== 'NAO INFORMADO' &&
    !incidentDate
  ) {
    issues.push({
      rowNumber,
      om: rawOm,
      field: FIELD_INCIDENT_DATE,
      value: incidentDateRaw,
      reason: 'data do início não pôde ser interpretada',
    });
    noteLines.push(`Data original do início da ocorrência: ${incidentDateRaw}`);
  }

  const reportedDateRaw = trimCell(row[FIELD_REPORTED_DATE]);
  const reportedAt = parseDateCell(row[FIELD_REPORTED_DATE]);
  if (
    reportedDateRaw &&
    normalizeLabel(reportedDateRaw) !== 'NAO INFORMADO' &&
    !reportedAt
  ) {
    issues.push({
      rowNumber,
      om: rawOm,
      field: FIELD_REPORTED_DATE,
      value: reportedDateRaw,
      reason: 'data da notificação não pôde ser interpretada',
    });
    noteLines.push(`Data original da notificação: ${reportedDateRaw}`);
  }

  const religiousSupport = trimCell(row[FIELD_SUPPORT_RELIGIOUS]);
  if (religiousSupport) {
    noteLines.push(`Suporte religioso informado na planilha: ${religiousSupport}`);
  }

  const observations = trimCell(row[FIELD_NOTES]);
  if (observations) {
    noteLines.push(`Observações da planilha: ${observations}`);
  }

  const procedureType = (administrativeProcedure.value ??
    'NOT_DEFINED') as CpcaProcedureTypeValue;
  const targetStatus = deriveTargetStatus(
    procedureSituation.value,
    trimCell(row[FIELD_PROCEDURE_SITUATION]),
    procedureType,
  );
  const createStatus = deriveCreateStatus(targetStatus, procedureType);
  const closureReferenceDate = reportedAt ?? incidentDate ?? null;

  const payload: CreateCpcaCaseDto = {
    omId: om.id,
    complaintType: violenceType.complaintType,
    notifierType: 'VITIMA',
    status: createStatus,
    procedureType,
    incidentDate: incidentDate ? incidentDate.toISOString() : undefined,
    aggressorRank: '',
    aggressorGender,
    aggressorAgeRange:
      (aggressorAgeRange.value ?? undefined) as CpcaAgeRangeValue | undefined,
    victimRank: '',
    victimGender,
    victimAgeRange:
      (victimAgeRange.value ?? undefined) as CpcaAgeRangeValue | undefined,
    victimIsNotifier: true,
    notifierRank: '',
    notifierGender: victimGender,
    notifierAgeRange:
      (victimAgeRange.value ?? undefined) as CpcaAgeRangeValue | undefined,
    detailedViolenceType: violenceType.detailedViolenceType as any,
    harassmentContext: context.value as any,
    occurrenceLocation: occurrenceLocation.value as any,
    incidentFrequency: incidentFrequency.value as any,
    hierarchicalFunctionalRelation: relation.value as any,
    occurrenceForm: occurrenceForm.value as any,
    administrativeProcedure: administrativeProcedure.value as any,
    procedureCurrentSituation: procedureSituation.value as any,
    confidentialityTermSigned:
      violenceType.complaintType === 'SEXUAL',
    psychologicalSupportProvided: parseBooleanFlag(trimCell(row[FIELD_SUPPORT_PSYCHO])),
    socialSupportProvided: parseBooleanFlag(trimCell(row[FIELD_SUPPORT_SOCIAL])),
    legalSupportProvided: parseBooleanFlag(trimCell(row[FIELD_SUPPORT_LEGAL])),
    retaliationRisk: retaliationReported.value === 'SIM',
    retaliationReported: retaliationReported.value as any,
    retaliationAgainst:
      retaliationReported.value === 'NAO'
        ? ('NAO_OCORREU_RETALIACAO' as any)
        : (retaliationAgainst.value as any),
    retaliationNotes: buildProcedureNotes(retaliationNoteLines) ?? undefined,
    procedureNotes: buildProcedureNotes(noteLines) ?? undefined,
  };

  const signature = toSignature({
    omId: om.id,
    complaintType: payload.complaintType,
    detailedViolenceType: payload.detailedViolenceType,
    incidentDate,
    reportedAt,
    harassmentContext: payload.harassmentContext,
    occurrenceLocation: payload.occurrenceLocation,
    aggressorRank: payload.aggressorRank,
    aggressorGender: payload.aggressorGender,
    aggressorAgeRange: payload.aggressorAgeRange,
    victimRank: payload.victimRank,
    victimGender: payload.victimGender,
    victimAgeRange: payload.victimAgeRange,
    notifierType: payload.notifierType,
    incidentFrequency: payload.incidentFrequency,
    hierarchicalFunctionalRelation: payload.hierarchicalFunctionalRelation,
    occurrenceForm: payload.occurrenceForm,
    procedureType: payload.procedureType,
    administrativeProcedure: payload.administrativeProcedure,
    procedureCurrentSituation: payload.procedureCurrentSituation,
    psychologicalSupportProvided: payload.psychologicalSupportProvided,
    legalSupportProvided: payload.legalSupportProvided,
    socialSupportProvided: payload.socialSupportProvided,
    retaliationReported: payload.retaliationReported,
    retaliationAgainst: payload.retaliationAgainst,
    retaliationNotes: payload.retaliationNotes,
    procedureNotes: payload.procedureNotes,
  });

  return {
    rowNumber,
    rawOm,
    om,
    payload,
    signature,
    reportedAt,
    targetStatus,
    targetArchivedAt: targetStatus === 'ARCHIVED' ? closureReferenceDate : null,
    issues,
  };
}

async function resolveImportActor(prisma: PrismaService) {
  return prisma.user.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, email: true, executiveHidePii: true },
  });
}

async function loadRows(filePath: string) {
  const workbook = XLSX.readFile(filePath, {
    raw: false,
    cellDates: false,
    codepage: 65001,
  });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Arquivo CSV sem aba/planilha legível.');
  }
  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json<CsvRow>(sheet, { defval: '' });
}

async function main() {
  const { filePath, apply, reportPath } = parseArgs();
  const resolvedFile = path.resolve(filePath);
  if (!fs.existsSync(resolvedFile)) {
    throw new Error(`Arquivo não encontrado: ${resolvedFile}`);
  }

  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const actor = await resolveImportActor(prisma);
    if (!actor) {
      throw new Error('Nenhum usuário ativo encontrado para registrar a importação.');
    }
    const rows = await loadRows(resolvedFile);
    const oms = await prisma.om.findMany({
      select: { id: true, code: true, name: true, uf: true, hasCpca: true },
      orderBy: { code: 'asc' },
    });
    const omLookups = buildOmLookups(oms);

    const unresolvedOms: ImportIssue[] = [];
    const skippedRows: ImportIssue[] = [];
    const partialIssues: ImportIssue[] = [];
    const duplicateSourceRows: ImportIssue[] = [];
    const prepared: PreparedCase[] = [];
    const rawSignatures = new Set<string>();

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      const rawSignature = JSON.stringify(row);
      if (rawSignatures.has(rawSignature)) {
        duplicateSourceRows.push({
          rowNumber,
          om: trimCell(row[FIELD_OM]),
          field: 'linha',
          value: trimCell(row[FIELD_OM]),
          reason: 'linha duplicada no CSV; ignorada',
        });
        continue;
      }
      rawSignatures.add(rawSignature);

      const rawOm = trimCell(row[FIELD_OM]);
      const om = resolveOm(rawOm, omLookups);
      if (!om) {
        unresolvedOms.push({
          rowNumber,
          om: rawOm,
          field: FIELD_OM,
          value: rawOm,
          reason: 'OM não encontrada na lista oficial do sistema',
        });
        continue;
      }

      const preparedCase = prepareCase(row, rowNumber, om);
      if (!preparedCase) {
        skippedRows.push({
          rowNumber,
          om: rawOm,
          field: FIELD_TYPE,
          value: trimCell(row[FIELD_TYPE]),
          reason: 'linha ignorada por tipo de assédio/violência não suportado',
        });
        continue;
      }
      partialIssues.push(...preparedCase.issues);
      prepared.push(preparedCase);
    }

    const omIds = Array.from(new Set(prepared.map((item) => item.om.id)));
    const existingCases = await prisma.cpcComplaintCase.findMany({
      where: {
        workflowScope: 'CPCA',
        omId: { in: omIds.length ? omIds : ['__none__'] },
      },
      select: {
        id: true,
        omId: true,
        complaintType: true,
        detailedViolenceType: true,
        incidentDate: true,
        reportedAt: true,
        harassmentContext: true,
        occurrenceLocation: true,
        aggressorRank: true,
        aggressorGender: true,
        aggressorAgeRange: true,
        victimRank: true,
        victimGender: true,
        victimAgeRange: true,
        notifierType: true,
        incidentFrequency: true,
        hierarchicalFunctionalRelation: true,
        occurrenceForm: true,
        procedureType: true,
        administrativeProcedure: true,
        procedureCurrentSituation: true,
        psychologicalSupportProvided: true,
        legalSupportProvided: true,
        socialSupportProvided: true,
        retaliationReported: true,
        retaliationAgainst: true,
        retaliationNotes: true,
        procedureNotes: true,
      },
    });
    const existingSignatures = new Set(existingCases.map((item) => toSignature(item)));
    const duplicateExistingRows: ImportIssue[] = [];
    const readyToImport: PreparedCase[] = [];

    for (const item of prepared) {
      if (existingSignatures.has(item.signature)) {
        duplicateExistingRows.push({
          rowNumber: item.rowNumber,
          om: item.rawOm,
          field: 'linha',
          value: item.om.code,
          reason: 'caso já existente no sistema; ignorado',
        });
        continue;
      }
      readyToImport.push(item);
    }

    const imported: Array<{ rowNumber: number; caseId: string; caseNumber: string; omCode: string }> = [];

    if (apply) {
      for (const item of readyToImport) {
        const nextCaseNumber = await generateCaseNumber(prisma, item.om.code);
        const {
          omId: _omId,
          localityId: _localityId,
          ...caseData
        } = item.payload;
        const created = await prisma.cpcComplaintCase.create({
          data: {
            caseNumber: nextCaseNumber,
            workflowScope: 'CPCA',
            om: { connect: { id: item.om.id } },
            createdBy: { connect: { id: actor.id } },
            updatedBy: { connect: { id: actor.id } },
            reportedAt: item.reportedAt ?? new Date(),
            status: item.targetStatus,
            archivedAt:
              item.targetStatus === 'ARCHIVED'
                ? item.targetArchivedAt ?? item.reportedAt ?? null
                : null,
            ...caseData,
          },
          select: { id: true, caseNumber: true },
        });
        await prisma.cpcComplaintStatusHistory.create({
          data: {
            complaintCaseId: created.id,
            fromStatus: null,
            toStatus: item.targetStatus,
            fromProcedure: null,
            toProcedure: item.payload.procedureType ?? 'NOT_DEFINED',
            note: 'Registro importado do compilado CSV.',
            changedById: actor.id,
            changedAt: item.reportedAt ?? new Date(),
          },
        });
        await prisma.auditLog.create({
          data: {
            userId: actor.id,
            resource: 'cpca_cases',
            action: 'create',
            entityId: created.id,
            diffJson: {
              omId: item.om.id,
              caseNumber: created.caseNumber,
              workflowScope: 'CPCA',
              complaintType: item.payload.complaintType,
              status: item.targetStatus,
              procedureType: item.payload.procedureType ?? 'NOT_DEFINED',
              source: 'import-cpca-compiled-csv',
            } as any,
          },
        });
        imported.push({
          rowNumber: item.rowNumber,
          caseId: created.id,
          caseNumber: created.caseNumber,
          omCode: item.om.code,
        });
        existingSignatures.add(item.signature);
      }
    }

    const report = {
      file: resolvedFile,
      mode: apply ? 'apply' : 'dry-run',
      totalRows: rows.length,
      duplicateRowsInFile: duplicateSourceRows.length,
      unresolvedOmCount: unresolvedOms.length,
      skippedCount: skippedRows.length,
      duplicateExistingCount: duplicateExistingRows.length,
      partialFieldIssueCount: partialIssues.length,
      readyToImportCount: readyToImport.length,
      importedCount: imported.length,
      autoAppliedDefaults: {
        confidentialityTermSignedForSexual: readyToImport.filter(
          (item) => item.payload.complaintType === 'SEXUAL',
        ).length,
      },
      unresolvedOms,
      skippedRows,
      duplicateSourceRows,
      duplicateExistingRows,
      partialIssues,
      imported,
    };

    if (reportPath) {
      fs.writeFileSync(path.resolve(reportPath), JSON.stringify(report, null, 2));
    }

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
