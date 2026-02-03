import { IsArray, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateMeetingDto {
  @IsDateString()
  datetime: string;

  @IsEnum(['NATIONAL', 'LOCALITY'])
  scope: string;

  @IsEnum(['PLANNED', 'HELD', 'CANCELLED'])
  status: string;

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

