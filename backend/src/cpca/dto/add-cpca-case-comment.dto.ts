import { IsString, MaxLength } from 'class-validator';

export class AddCpcaCaseCommentDto {
  @IsString()
  @MaxLength(2000)
  text: string;
}
