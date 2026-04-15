import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateOmDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  uf?: string;

  @IsOptional()
  @IsBoolean()
  hasCpca?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
