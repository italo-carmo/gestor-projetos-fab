import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBestPracticeDto {
  @IsString()
  @MaxLength(140)
  title: string;

  @IsString()
  @MaxLength(1200)
  content: string;

  @IsOptional()
  @IsString()
  localityId?: string | null;

  @IsOptional()
  @IsBoolean()
  isCommission?: boolean;
}


