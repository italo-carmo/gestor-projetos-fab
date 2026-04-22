import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CPCA_CHECKLIST_ITEM_KEYS } from '../cpca-checklist.constants';

class UpdateCpcaChecklistItemDto {
  @IsIn(CPCA_CHECKLIST_ITEM_KEYS)
  itemKey!: string;

  @IsBoolean()
  isCompleted!: boolean;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  completedAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  speakerName?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateCpcaChecklistHistoryEntryDto)
  historyEntries?: UpdateCpcaChecklistHistoryEntryDto[];
}

class UpdateCpcaChecklistHistoryEntryDto {
  @IsOptional()
  @IsString()
  id?: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  completedAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  speakerName?: string | null;
}

export class UpdateCpcaChecklistDto {
  @IsOptional()
  @IsString()
  localityId?: string;

  @IsArray()
  @ArrayMinSize(CPCA_CHECKLIST_ITEM_KEYS.length)
  @ArrayMaxSize(CPCA_CHECKLIST_ITEM_KEYS.length)
  @ValidateNested({ each: true })
  @Type(() => UpdateCpcaChecklistItemDto)
  items!: UpdateCpcaChecklistItemDto[];
}
