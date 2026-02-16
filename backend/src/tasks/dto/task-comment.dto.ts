import { IsString, MaxLength } from 'class-validator';

export class TaskCommentDto {
  @IsString()
  @MaxLength(4000)
  text: string;
}

