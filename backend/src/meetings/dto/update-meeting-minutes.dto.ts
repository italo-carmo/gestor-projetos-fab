import { IsOptional, IsString } from 'class-validator';

export class UpdateMeetingMinutesDto {
  @IsOptional()
  @IsString()
  minutes?: string | null;
}
