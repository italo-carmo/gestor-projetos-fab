import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class TaskTemplateDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsString()
  phaseId: string;

  @IsOptional()
  @IsString()
  specialtyId?: string | null;

  @IsOptional()
  @IsString()
  eloRoleId?: string | null;

  @IsBoolean()
  appliesToAllLocalities: boolean;

  @IsBoolean()
  reportRequiredDefault: boolean;
}
