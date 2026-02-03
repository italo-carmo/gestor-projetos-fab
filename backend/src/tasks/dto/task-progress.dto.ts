import { IsInt, Max, Min } from 'class-validator';

export class TaskProgressDto {
  @IsInt()
  @Min(0)
  @Max(100)
  progressPercent: number;
}
