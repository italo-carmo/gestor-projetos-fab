import { IsEnum, IsString } from 'class-validator';

export class CreateKpiDto {
  @IsString()
  key: string;

  @IsString()
  label: string;

  @IsEnum(['DEFAULT', 'EXECUTIVE'])
  visibility: string;
}

