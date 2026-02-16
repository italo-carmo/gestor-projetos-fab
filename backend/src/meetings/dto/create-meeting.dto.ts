import { IsArray, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateMeetingDto {
  @IsDateString()
  datetime: string;

  @IsString()
  scope: string;

  @IsEnum(['PLANNED', 'HELD', 'CANCELLED'])
  status: string;

  @IsEnum(['ONLINE', 'PRESENCIAL'])
  meetingType: string;

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
