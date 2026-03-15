import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  MISSION_CHECKLIST_CLASSIFICATIONS,
  MISSION_CHECKLIST_ITEM_IDS,
} from '../mission-checklist.constants';

export class UpsertMissionChecklistItemDto {
  @IsString()
  @IsIn(MISSION_CHECKLIST_ITEM_IDS)
  id: string;

  @IsString()
  @IsIn(MISSION_CHECKLIST_CLASSIFICATIONS)
  classification: (typeof MISSION_CHECKLIST_CLASSIFICATIONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class UpsertMissionChecklistDto {
  @IsString()
  @MaxLength(64)
  omId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MISSION_CHECKLIST_ITEM_IDS.length)
  @ValidateNested({ each: true })
  @Type(() => UpsertMissionChecklistItemDto)
  items: UpsertMissionChecklistItemDto[];
}
