import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export enum RecruitMemberStatusDto {
  RECRUITMENT_TO_START = 'RECRUITMENT_TO_START',
  RECRUITMENT_STARTED = 'RECRUITMENT_STARTED',
  DISMISSED = 'DISMISSED',
  ASSIGNED_TO_OM = 'ASSIGNED_TO_OM',
}

export class ReplaceLocalityRecruitMemberItemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  name!: string;

  @IsEnum(RecruitMemberStatusDto)
  status!: RecruitMemberStatusDto;

  @IsOptional()
  @IsString()
  dismissalReason?: string | null;

  @IsOptional()
  @IsString()
  destinationLocalityId?: string | null;

  @IsOptional()
  @IsString()
  comment?: string | null;
}

export class ReplaceLocalityRecruitsMembersDto {
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => ReplaceLocalityRecruitMemberItemDto)
  items!: ReplaceLocalityRecruitMemberItemDto[];
}
