import { IsHexColor, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateLessonLearnedTypeDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsHexColor()
  colorHex: string;

  @IsOptional()
  @IsHexColor()
  textColorHex?: string;
}
