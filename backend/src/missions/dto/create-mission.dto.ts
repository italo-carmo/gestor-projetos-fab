import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateMissionDto {
  @IsString()
  @MaxLength(180)
  title: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsString()
  localityId: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
