import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class GenerateMeetingTasksDto {
  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  phaseId?: string;

  @IsOptional()
  @IsString()
  specialtyId?: string | null;

  @IsOptional()
  @IsBoolean()
  reportRequired?: boolean;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  assigneeId?: string | null;

  @IsArray()
  localities: { localityId: string; dueDate: string }[];
}

