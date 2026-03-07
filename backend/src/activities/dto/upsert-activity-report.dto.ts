import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpsertActivityReportDto {
  @IsDateString()
  date: string;

  @IsString()
  location: string;

  @IsString()
  responsible: string;

  @IsString()
  activityAnalysis: string;

  @IsOptional()
  @IsString()
  missionSupport?: string;

  @IsOptional()
  @IsString()
  introduction?: string;

  @IsOptional()
  @IsString()
  missionObjectives?: string;

  @IsOptional()
  @IsString()
  executionSchedule?: string;

  @IsString()
  activitiesPerformed: string;

  @IsInt()
  @Min(0)
  participantsCount: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  participantsMaleCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  participantsFemaleCount?: number;

  @IsOptional()
  @IsString()
  publicProfile?: string;

  @IsInt()
  @Min(0)
  instructorsCount: number;

  @IsInt()
  @Min(0)
  recruitsCount: number;

  @IsInt()
  @Min(0)
  eloPsychologyCount: number;

  @IsInt()
  @Min(0)
  eloSocialAssistanceCount: number;

  @IsInt()
  @Min(0)
  eloGraduadoMasterCount: number;

  @IsString()
  participantsCharacteristics: string;

  @IsOptional()
  @IsString()
  mainPointsObserved?: string;

  @IsOptional()
  @IsString()
  attentionPoints?: string;

  @IsOptional()
  @IsString()
  nextSteps?: string;

  @IsOptional()
  @IsString()
  referencesAndAttachments?: string;

  @IsString()
  conclusion: string;

  @IsString()
  city: string;

  @IsDateString()
  closingDate: string;
}
