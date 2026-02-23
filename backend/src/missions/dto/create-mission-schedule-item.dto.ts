import { IsDateString, IsInt, IsString, MaxLength, Min } from 'class-validator';

export class CreateMissionScheduleItemDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsDateString()
  startAt: string;

  @IsInt()
  @Min(1)
  durationMinutes: number;

  @IsString()
  @MaxLength(200)
  location: string;

  @IsString()
  @MaxLength(200)
  responsible: string;

  @IsString()
  participants: string;
}
