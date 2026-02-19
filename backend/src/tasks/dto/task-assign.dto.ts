import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

export class TaskAssignDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assigneeIds?: string[];

  @IsOptional()
  @IsString()
  assignedToId?: string | null;

  @IsOptional()
  @IsString()
  localityId?: string | null;

  @IsOptional()
  @IsString()
  assigneeId?: string | null;

  @IsOptional()
  @IsIn(['USER', 'ELO', 'LOCALITY_COMMAND', 'LOCALITY_COMMANDER'])
  assigneeType?: 'USER' | 'ELO' | 'LOCALITY_COMMAND' | 'LOCALITY_COMMANDER' | null;
}
