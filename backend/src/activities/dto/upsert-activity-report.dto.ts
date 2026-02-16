import { IsDateString, IsInt, IsString, Min } from 'class-validator';

export class UpsertActivityReportDto {
  @IsDateString()
  date: string;

  @IsString()
  location: string;

  @IsString()
  responsible: string;

  @IsString()
  missionSupport: string;

  @IsString()
  introduction: string;

  @IsString()
  missionObjectives: string;

  @IsString()
  executionSchedule: string;

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
