import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateDashboardNationalCardDto {
  @IsOptional()
  @IsString()
  @MaxLength(140)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  backgroundColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  textColor?: string;
}
