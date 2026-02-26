import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CPCA_CASE_STATUSES,
  CPCA_COMPLAINT_TYPES,
  CPCA_GENDERS,
  CPCA_NOTIFIER_TYPES,
  CPCA_PROCEDURE_TYPES,
} from './create-cpca-case.dto';

export class UpdateCpcaCaseDto {
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
  @IsString()
  @MaxLength(120)
  aggressorRank?: string;

  @IsOptional()
  @IsIn(CPCA_GENDERS)
  aggressorGender?: (typeof CPCA_GENDERS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  victimRank?: string;

  @IsOptional()
  @IsIn(CPCA_GENDERS)
  victimGender?: (typeof CPCA_GENDERS)[number];

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
