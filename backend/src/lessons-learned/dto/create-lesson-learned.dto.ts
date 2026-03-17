import { IsString, MaxLength } from 'class-validator';

export class CreateLessonLearnedDto {
  @IsString()
  @MaxLength(140)
  title: string;

  @IsString()
  @MaxLength(1200)
  content: string;

  @IsString()
  typeId: string;
}
