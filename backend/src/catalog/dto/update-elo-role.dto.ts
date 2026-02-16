import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateEloRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
