import { IsString, MaxLength } from 'class-validator';

export class ActivityCommentDto {
  @IsString()
  @MaxLength(4000)
  text: string;
}

