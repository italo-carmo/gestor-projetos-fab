import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateEloDto {
  @IsOptional()
  @IsString()
  localityId?: string;

  @IsOptional()
  @IsEnum(['PSICOLOGIA', 'SSO', 'JURIDICO', 'CPCA', 'GRAD_MASTER'])
  roleType?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  rank?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  email?: string | null;

  @IsOptional()
  @IsString()
  om?: string | null;
}

