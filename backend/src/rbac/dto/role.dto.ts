import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class RoleDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isSystemRole?: boolean;

  @IsOptional()
  @IsBoolean()
  wildcard?: boolean;
}
