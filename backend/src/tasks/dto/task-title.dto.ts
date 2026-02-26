import { IsString } from 'class-validator';

export class TaskTitleDto {
  @IsString()
  title: string;
}
