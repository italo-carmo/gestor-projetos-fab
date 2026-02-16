import { IsArray, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateMeetingDto {
  @IsOptional()
  @IsDateString()
  datetime?: string;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsEnum(['PLANNED', 'HELD', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @IsEnum(['ONLINE', 'PRESENCIAL'])
  meetingType?: string;

  @IsOptional()
  @IsString()
  meetingLink?: string | null;

  @IsOptional()
  @IsString()
  agenda?: string | null;

  @IsOptional()
  @IsString()
  localityId?: string | null;

  @IsOptional()
  @IsArray()
  participantIds?: string[];
}
