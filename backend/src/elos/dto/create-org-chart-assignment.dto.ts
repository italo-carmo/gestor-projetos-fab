import { IsOptional, IsString } from 'class-validator';

export class CreateOrgChartAssignmentDto {
  @IsString()
  localityId!: string;

  @IsString()
  eloRoleId!: string;

  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  rank?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  om?: string | null;
}
