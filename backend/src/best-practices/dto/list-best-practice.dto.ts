import { IsOptional, IsString } from 'class-validator';

export class ListBestPracticeDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  localityId?: string;

  @IsOptional()
  @IsString()
  typeId?: string;
}
