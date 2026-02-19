import { IsOptional, IsString } from 'class-validator';

export class UpdateEloDto {
  @IsOptional()
  @IsString()
  localityId?: string;

  @IsOptional()
  @IsString()
  eloRoleId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  userId?: string;

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
