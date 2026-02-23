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

  @IsString()
  participantsCharacteristics: string;

  @IsString()
  conclusion: string;

  @IsString()
  city: string;

  @IsDateString()
  closingDate: string;
}
