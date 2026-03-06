import { IsOptional, IsString } from 'class-validator';

export class ListLessonLearnedDto {
  @IsOptional()
  @IsString()
  q?: string;
}


