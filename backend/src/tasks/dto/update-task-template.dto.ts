import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateTaskTemplateDto {
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
  @IsString()
  eloRoleId?: string | null;

  @IsOptional()
  @IsBoolean()
  appliesToAllLocalities?: boolean;

  @IsOptional()
  @IsBoolean()
  reportRequiredDefault?: boolean;
}
