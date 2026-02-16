import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateEloRoleDto {
  @IsString()
  @MinLength(1)
  code: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
