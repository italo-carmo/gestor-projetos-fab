import { IsArray, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateMeetingDto {
  @IsOptional()
  @IsDateString()
  datetime?: string;

  @IsOptional()
  @IsEnum(['NATIONAL', 'LOCALITY'])
  scope?: string;

  @IsOptional()
  @IsEnum(['PLANNED', 'HELD', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @IsString()
  agenda?: string | null;

  @IsOptional()
  @IsString()
  localityId?: string | null;

  @IsOptional()
  @IsArray()
  participantsJson?: any[];
}

