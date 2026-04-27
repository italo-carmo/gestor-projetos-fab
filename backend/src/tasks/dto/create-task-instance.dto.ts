import { ActivityScope } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateTaskInstanceDto {
  @IsOptional()
  @IsEnum(ActivityScope)
  scope?: ActivityScope;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsString()
  phaseId: string;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsArray()
  @IsString({ each: true })
  localityIds: string[];

  @IsOptional()
  @IsString()
  assignedToId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assigneeIds?: string[];
}
