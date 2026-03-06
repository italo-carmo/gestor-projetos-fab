import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateBestPracticeDto {
  @IsOptional()
  @IsString()
  @MaxLength(140)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  content?: string;

  @IsOptional()
  @IsString()
  localityId?: string | null;

  @IsOptional()
  @IsBoolean()
  isCommission?: boolean;
}


