import { IsInt, IsString, Matches, MaxLength, Min } from 'class-validator';

export class CreateActivityScheduleItemDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  startTime: string;

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
