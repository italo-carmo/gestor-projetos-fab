import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateLocalityDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  commandName?: string | null;

  @IsOptional()
  @IsString()
  commanderName?: string | null;

  @IsOptional()
  @IsDateString()
  visitDate?: string | null;

  @IsOptional()
  recruitsFemaleCountCurrent?: number | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

