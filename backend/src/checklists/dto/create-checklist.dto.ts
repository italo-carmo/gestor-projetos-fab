import { IsOptional, IsString } from 'class-validator';

export class CreateChecklistDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  phaseId?: string | null;

  @IsOptional()
  @IsString()
  specialtyId?: string | null;

  @IsOptional()
  @IsString()
  eloRoleId?: string | null;
}

