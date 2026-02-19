import { IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @ValidateIf((_o, v) => v != null)
  @IsString()
  @MinLength(3)
  eloRoleId?: string | null;
}
