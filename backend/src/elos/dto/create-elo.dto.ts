import { IsOptional, IsString } from 'class-validator';

export class CreateEloDto {
  @IsString()
  localityId: string;

  @IsString()
  eloRoleId: string;

  @IsString()
  name: string;

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

