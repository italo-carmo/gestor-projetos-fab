import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const MISSION_FIELD_ACTIVITY_ACTIONS = ['CREATE', 'LINK'] as const;

export class MissionScheduleFieldActivityItemDto {
  @IsString()
  scheduleItemId: string;

  @IsString()
  @IsIn(MISSION_FIELD_ACTIVITY_ACTIONS)
  action: (typeof MISSION_FIELD_ACTIVITY_ACTIONS)[number];

  @IsOptional()
  @IsString()
  activityId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  activityTypeId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialtyIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  responsibleUserIds?: string[];

  @IsOptional()
  @IsDateString()
  eventDate?: string | null;

  @IsOptional()
  @IsBoolean()
  reportRequired?: boolean;
}

export class UpsertMissionScheduleFieldActivitiesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MissionScheduleFieldActivityItemDto)
  items: MissionScheduleFieldActivityItemDto[];
}
