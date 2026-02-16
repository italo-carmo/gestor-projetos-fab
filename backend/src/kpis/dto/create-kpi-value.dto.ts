import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateKpiValueDto {
  @IsDateString()
  date: string;

  @IsNumber()
  value: number;

  @IsOptional()
  @IsString()
  localityId?: string | null;

  @IsOptional()
  @IsString()
  specialtyId?: string | null;
}

