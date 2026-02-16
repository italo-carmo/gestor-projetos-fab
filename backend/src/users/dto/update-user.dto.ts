import { IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @ValidateIf((_o, v) => v != null)
  @IsUUID()
  eloRoleId?: string | null;
}
