import {
  ArrayUnique,
  IsBoolean,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export const CPCA_COMPLAINT_TYPES = ['MORAL', 'SEXUAL'] as const;
export const CPCA_NOTIFIER_TYPES = [
  'VITIMA',
  'TESTEMUNHA',
  'TERCEIRO',
] as const;
export const CPCA_CASE_STATUSES = [
  'RECEIVED',
  'PROTECTION_MEASURES',
  'PRELIMINARY_ANALYSIS',
  'PROCEDURE_DEFINED',
  'INVESTIGATION',
  'CONCLUDED',
  'ARCHIVED',
] as const;
export const CPCA_PROCEDURE_TYPES = [
  'NOT_DEFINED',
  'PATD',
  'APF',
  'SINDICANCIA',
  'PAD',
  'IPM',
  'BOLETIM_OCORRENCIA',
  'INQUERITO_CIVIL',
  'NAO_HOUVE',
  'INQUERITO_POLICIAL_COMUM',
  'NOTICIA_FATO',
  'CONSELHO_DISCIPLINA',
  'CONSELHO_JUSTIFICACAO',
] as const;
export const CPCA_GENDERS = ['MASCULINO', 'FEMININO', 'NAO_INFORMADO'] as const;
export const CPCA_DETAILED_VIOLENCE_TYPES = [
  'ASSEDIO_MORAL',
  'ASSEDIO_SEXUAL',
  'VIOLENCIA_DOMESTICA_FISICA',
  'VIOLENCIA_DOMESTICA_PSICOLOGICA',
  'VIOLENCIA_DOMESTICA_MORAL',
  'VIOLENCIA_DOMESTICA_PATRIMONIAL',
  'VIOLENCIA_DOMESTICA_SEXUAL',
  'VIOLENCIA_DOMESTICA_VICARIA',
  'IMPORTUNACAO_SEXUAL',
  'INJURIA_RACIAL',
  'INJURIA',
  'CALUNIA',
  'DIFAMACAO',
  'DISCRIMINACAO',
  'DENUNCIACAO_CALUNIOSA',
  'ATO_DE_LIBIDINAGEM',
  'PRESUNCAO_DE_VIOLENCIA',
  'CORRUPCAO_DE_MENORES',
  'ESTUPRO_DE_VULNERAVEL',
  'SEDUCAO',
  'REGISTRO_NAO_AUTORIZADO_DE_INTIMIDADE_SEXUAL',
  'VIOLACAO_SEXUAL_MEDIANTE_FRAUDE',
  'ESTUPRO',
] as const;
export const CPCA_HARASSMENT_CONTEXTS = ['PRESENCIAL', 'VIRTUAL'] as const;
export const CPCA_OCCURRENCE_LOCATIONS = [
  'INTERIOR_OM',
  'EVENTO_EXTERNO_RELACIONADO_TRABALHO',
  'EVENTO_EXTERNO_NAO_RELACIONADO_TRABALHO',
  'AMBIENTE_PESSOAL',
  'VIA_PUBLICA',
  'TRANSPORTE_PUBLICO',
  'TRANSPORTE_INSTITUCIONAL',
  'RESIDENCIA_ACUSADOR',
  'APLICATIVOS_MENSAGERIA',
  'EMAIL',
  'REUNIAO_ONLINE_TRABALHO',
  'REDES_SOCIAIS',
  'RESIDENCIA_VITIMA_NOTICIANTE',
] as const;
export const CPCA_AGE_RANGES = [
  '15_18',
  '19_25',
  '26_30',
  '31_35',
  '36_40',
  '41_45',
  '46_50',
  '51_55',
  'MAIOR_55',
] as const;
export const CPCA_INCIDENT_FREQUENCIES = [
  'UMA_VEZ',
  'DUAS_VEZES',
  'TRES_VEZES',
  'QUATRO_VEZES',
  'CINCO_VEZES',
  'MAIOR_CINCO',
] as const;
export const CPCA_HIERARCHICAL_RELATIONS = [
  'SUPERIOR_HIERARQUICO',
  'CHEFE_IMEDIATO',
  'SUBORDINADO',
  'SUBORDINADO_DIRETO',
  'MESMA_GRADUACAO',
  'INSTRUTOR_PROFESSOR',
  'ALUNO',
  'PRESTADOR_SERVICO',
  'CONJUGE',
  'OUTROS',
  'CIVIL',
  'CONJUGE_MILITAR',
  'FAMILIAR',
] as const;
export const CPCA_OCCURRENCE_FORMS = [
  'HUMILHACAO_PUBLICA',
  'EXCLUSAO_ISOLAMENTO',
  'AMEACAS_INTIMIDACAO',
  'CRITICAS_EXCESSIVAS',
  'INJUSTICAS',
  'COMENTARIOS_SEXISTAS',
  'CONTATO_FISICO_INDESEJADO',
  'TENTATIVA_CONTATO_FISICO_INDEVIDO',
  'CHANTAGEM_INTIMIDACAO_FAVOR_SEXUAL',
  'VIOLENCIA_FISICA',
  'VIOLENCIA_PSICOLOGICA',
  'VIOLENCIA_PATRIMONIAL',
  'OUTROS',
  'VIOLENCIA_SEXUAL',
  'VIOLENCIA_MORAL',
  'VIGILANCIA_EXCESSIVA',
  'EXIBICAO_MATERIAL_PORNOGRAFICO',
] as const;
export const CPCA_ADMIN_PROCEDURES = [
  'SINDICANCIA',
  'IPM',
  'PATD',
  'APF',
  'PAD',
  'BOLETIM_OCORRENCIA',
  'INQUERITO_CIVIL',
  'NAO_HOUVE',
  'INQUERITO_POLICIAL_COMUM',
  'NOTICIA_FATO',
  'CONSELHO_DISCIPLINA',
  'CONSELHO_JUSTIFICACAO',
] as const;
export const CPCA_PROCEDURE_CURRENT_SITUATIONS = [
  'EM_ANDAMENTO',
  'MEDIDA_DISCIPLINAR_APLICADA',
  'OFERECIDA_DENUNCIA',
  'ARQUIVADO_PELA_JUSTICA',
  'CONDENADO_PELA_JUSTICA',
  'TRANSFERENCIA_ACUSADO',
  'TRANSFERENCIA_ACUSADOR',
  'MEDIDA_PROTETIVA',
  'OUTROS',
  'NAO_APLICAVEL',
] as const;
export const CPCA_RETALIATION_REPORTED_OPTIONS = [
  'SIM',
  'NAO',
  'NAO_INFORMADO',
] as const;
export const CPCA_RETALIATION_AGAINST_OPTIONS = [
  'VITIMA',
  'TESTEMUNHAS',
  'SINDICANTE',
  'ENCARREGADO_INQUERITO',
  'NAO_OCORREU_RETALIACAO',
] as const;

export class CreateCpcaCaseDto {
  @IsOptional()
  @IsString()
  omId?: string;

  @IsOptional()
  @IsString()
  localityId?: string;

  @IsIn(CPCA_COMPLAINT_TYPES)
  complaintType: (typeof CPCA_COMPLAINT_TYPES)[number];

  @IsOptional()
  @IsIn(CPCA_NOTIFIER_TYPES)
  notifierType?: (typeof CPCA_NOTIFIER_TYPES)[number];

  @IsOptional()
  @IsIn(CPCA_CASE_STATUSES)
  status?: (typeof CPCA_CASE_STATUSES)[number];

  @IsOptional()
  @IsIn(CPCA_PROCEDURE_TYPES)
  procedureType?: (typeof CPCA_PROCEDURE_TYPES)[number];

  @IsOptional()
  @IsISO8601()
  incidentDate?: string;

  @IsOptional()
  @IsISO8601()
  reportedAt?: string;

  @IsString()
  @MaxLength(120)
  aggressorRank: string;

  @IsIn(CPCA_GENDERS)
  aggressorGender: (typeof CPCA_GENDERS)[number];

  @IsOptional()
  @IsIn(CPCA_AGE_RANGES)
  aggressorAgeRange?: (typeof CPCA_AGE_RANGES)[number];

  @IsString()
  @MaxLength(120)
  victimRank: string;

  @IsIn(CPCA_GENDERS)
  victimGender: (typeof CPCA_GENDERS)[number];

  @IsOptional()
  @IsIn(CPCA_AGE_RANGES)
  victimAgeRange?: (typeof CPCA_AGE_RANGES)[number];

  @IsOptional()
  @IsBoolean()
  victimIsNotifier?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  notifierRank?: string;

  @IsOptional()
  @IsIn(CPCA_GENDERS)
  notifierGender?: (typeof CPCA_GENDERS)[number];

  @IsOptional()
  @IsIn(CPCA_AGE_RANGES)
  notifierAgeRange?: (typeof CPCA_AGE_RANGES)[number];

  @IsOptional()
  @IsIn(CPCA_DETAILED_VIOLENCE_TYPES)
  detailedViolenceType?: (typeof CPCA_DETAILED_VIOLENCE_TYPES)[number];

  @IsOptional()
  @IsIn(CPCA_HARASSMENT_CONTEXTS)
  harassmentContext?: (typeof CPCA_HARASSMENT_CONTEXTS)[number];

  @IsOptional()
  @IsIn(CPCA_OCCURRENCE_LOCATIONS)
  occurrenceLocation?: (typeof CPCA_OCCURRENCE_LOCATIONS)[number];

  @IsOptional()
  @IsIn(CPCA_INCIDENT_FREQUENCIES)
  incidentFrequency?: (typeof CPCA_INCIDENT_FREQUENCIES)[number];

  @IsOptional()
  @IsIn(CPCA_HIERARCHICAL_RELATIONS)
  hierarchicalFunctionalRelation?: (typeof CPCA_HIERARCHICAL_RELATIONS)[number];

  @IsOptional()
  @IsIn(CPCA_OCCURRENCE_FORMS)
  occurrenceForm?: (typeof CPCA_OCCURRENCE_FORMS)[number];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(CPCA_OCCURRENCE_FORMS, { each: true })
  occurrenceForms?: (typeof CPCA_OCCURRENCE_FORMS)[number][];

  @IsOptional()
  @IsIn(CPCA_ADMIN_PROCEDURES)
  administrativeProcedure?: (typeof CPCA_ADMIN_PROCEDURES)[number];

  @IsOptional()
  @IsIn(CPCA_PROCEDURE_CURRENT_SITUATIONS)
  procedureCurrentSituation?: (typeof CPCA_PROCEDURE_CURRENT_SITUATIONS)[number];

  @IsOptional()
  @IsIn(CPCA_RETALIATION_REPORTED_OPTIONS)
  retaliationReported?: (typeof CPCA_RETALIATION_REPORTED_OPTIONS)[number];

  @IsOptional()
  @IsIn(CPCA_RETALIATION_AGAINST_OPTIONS)
  retaliationAgainst?: (typeof CPCA_RETALIATION_AGAINST_OPTIONS)[number];

  @IsOptional()
  @IsInt()
  @Min(0)
  evidenceCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  evidenceSummary?: string;

  @IsOptional()
  @IsBoolean()
  evidenceSummaryPrivacyOverride?: boolean;

  @IsOptional()
  @IsBoolean()
  confidentialityTermSigned?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  confidentialityHandlingNotes?: string;

  @IsOptional()
  @IsBoolean()
  cpcaMembersExcludedFromInquiry?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  immediateProtectionMeasures?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  privateSupportActions?: string;

  @IsOptional()
  @IsBoolean()
  psychologicalSupportProvided?: boolean;

  @IsOptional()
  @IsBoolean()
  medicalSupportProvided?: boolean;

  @IsOptional()
  @IsBoolean()
  socialSupportProvided?: boolean;

  @IsOptional()
  @IsBoolean()
  legalSupportProvided?: boolean;

  @IsOptional()
  @IsBoolean()
  contactRestrictionApplied?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  preliminaryAnalysis?: string;

  @IsOptional()
  @IsBoolean()
  preliminaryReportGenerated?: boolean;

  @IsOptional()
  @IsISO8601()
  preliminaryReportDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  procedureReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  procedureNotes?: string;

  @IsOptional()
  @IsBoolean()
  womenLedHandlingPrioritized?: boolean;

  @IsOptional()
  @IsBoolean()
  victimAccusedSeparationEvaluated?: boolean;

  @IsOptional()
  @IsBoolean()
  victimAccusedSeparationApplied?: boolean;

  @IsOptional()
  @IsBoolean()
  accusedDefenseEnsured?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  outcomeSummary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  archiveReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notifierFeedbackSummary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  victimFeedbackSummary?: string;

  @IsOptional()
  @IsISO8601()
  notifierFeedbackDate?: string;

  @IsOptional()
  @IsISO8601()
  victimFeedbackDate?: string;

  @IsOptional()
  @IsBoolean()
  retaliationRisk?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  retaliationNotes?: string;

  @IsOptional()
  @IsBoolean()
  outsourcedAccused?: boolean;

  @IsOptional()
  @IsISO8601()
  contractorReferralDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  contractorFollowUpNotes?: string;
}
