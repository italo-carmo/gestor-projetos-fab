import { ActivityScope } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export class GenerateInstancesDto {
  @IsOptional()
  @IsEnum(ActivityScope)
  scope?: ActivityScope;

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
