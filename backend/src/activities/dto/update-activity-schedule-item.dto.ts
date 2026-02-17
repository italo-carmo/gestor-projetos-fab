import { IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class UpdateActivityScheduleItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  startTime?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  responsible?: string;

  @IsOptional()
  @IsString()
  participants?: string;
}
