import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateLessonLearnedDto {
  @IsOptional()
  @IsString()
  @MaxLength(140)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  content?: string;
}


