import { IsArray, IsOptional, IsString } from 'class-validator';

export class GenerateInstancesDto {
  @IsArray()
  localities: { localityId: string; dueDate: string }[];

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  meetingId?: string | null;

  @IsOptional()
  @IsString()
  assignedToId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assigneeIds?: string[];
}
