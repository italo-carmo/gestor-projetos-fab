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
import {
  CPCA_ADMIN_PROCEDURES,
  CPCA_AGE_RANGES,
  CPCA_CASE_STATUSES,
  CPCA_COMPLAINT_TYPES,
  CPCA_DETAILED_VIOLENCE_TYPES,
  CPCA_GENDERS,
  CPCA_HARASSMENT_CONTEXTS,
  CPCA_HIERARCHICAL_RELATIONS,
  CPCA_INCIDENT_FREQUENCIES,
  CPCA_NOTIFIER_TYPES,
  CPCA_OCCURRENCE_FORMS,
  CPCA_OCCURRENCE_LOCATIONS,
  CPCA_PROCEDURE_CURRENT_SITUATIONS,
  CPCA_PROCEDURE_TYPES,
  CPCA_RETALIATION_AGAINST_OPTIONS,
  CPCA_RETALIATION_REPORTED_OPTIONS,
} from './create-cpca-case.dto';

export class UpdateCpcaCaseDto {
  @IsOptional()
  @IsString()
  omId?: string;

  @IsOptional()
  @IsString()
  localityId?: string;

  @IsOptional()
  @IsIn(CPCA_COMPLAINT_TYPES)
  complaintType?: (typeof CPCA_COMPLAINT_TYPES)[number];

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

  @IsOptional()
  @IsString()
  @MaxLength(120)
  aggressorRank?: string;

  @IsOptional()
  @IsIn(CPCA_GENDERS)
  aggressorGender?: (typeof CPCA_GENDERS)[number];

  @IsOptional()
  @IsIn(CPCA_AGE_RANGES)
  aggressorAgeRange?: (typeof CPCA_AGE_RANGES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  victimRank?: string;

  @IsOptional()
  @IsIn(CPCA_GENDERS)
  victimGender?: (typeof CPCA_GENDERS)[number];

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

  @IsOptional()
  @IsISO8601()
  archivedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  statusChangeNote?: string;
}
