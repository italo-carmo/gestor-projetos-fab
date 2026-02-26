import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateLocalityRecruitsDto {
  @IsInt()
  @Min(0)
  recruitsFemaleCountCurrent: number;

  @IsOptional()
  @IsString()
  dismissalReason?: string | null;
}
