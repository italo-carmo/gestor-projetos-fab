import { IsString } from 'class-validator';

export class TaskStatusDto {
  @IsString()
  status: string;
}
