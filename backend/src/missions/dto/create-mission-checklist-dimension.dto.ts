import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { MISSION_CHECKLIST_SECTION_IDS } from '../mission-checklist.constants';

export class CreateMissionChecklistDimensionDto {
  @IsString()
  @IsIn(MISSION_CHECKLIST_SECTION_IDS)
  sectionId: (typeof MISSION_CHECKLIST_SECTION_IDS)[number];

  @IsString()
  @MaxLength(240)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  prompt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
