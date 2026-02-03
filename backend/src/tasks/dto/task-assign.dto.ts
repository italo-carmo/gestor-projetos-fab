import { IsOptional, IsString } from 'class-validator';

export class TaskAssignDto {
  @IsOptional()
  @IsString()
  assignedToId?: string | null;
}
