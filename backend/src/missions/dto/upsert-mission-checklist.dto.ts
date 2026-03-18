import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MISSION_CHECKLIST_CLASSIFICATIONS } from '../mission-checklist.constants';

export class UpsertMissionChecklistItemDto {
  @IsString()
  @MaxLength(120)
  id: string;

  @IsString()
  @IsIn(MISSION_CHECKLIST_CLASSIFICATIONS)
  classification: (typeof MISSION_CHECKLIST_CLASSIFICATIONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  photos?: string[];
}

export class UpsertMissionChecklistDto {
  @IsString()
  @MaxLength(64)
  omId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpsertMissionChecklistItemDto)
  items: UpsertMissionChecklistItemDto[];
}
