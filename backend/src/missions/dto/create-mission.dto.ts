import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateMissionDto {
  @IsString()
  @MaxLength(180)
  title: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsString()
  localityId: string;

  @IsOptional()
  @IsIn(['SMIF', 'CIPAVD'])
  scope?: 'SMIF' | 'CIPAVD';

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
