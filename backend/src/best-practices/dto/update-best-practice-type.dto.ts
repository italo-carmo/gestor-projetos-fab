import { IsHexColor, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateBestPracticeTypeDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsHexColor()
  colorHex?: string;

  @IsOptional()
  @IsHexColor()
  textColorHex?: string;
}

