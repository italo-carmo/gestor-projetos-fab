import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

const trimText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const trimUuidNullable = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export class UpsertLdapUserDto {
  @Transform(trimText)
  @IsString()
  @MinLength(3)
  uid!: string;

  @Transform(trimText)
  @IsString()
  @MinLength(3)
  roleId!: string;

  @IsOptional()
  @IsBoolean()
  replaceExistingRoles?: boolean;

  @IsOptional()
  @Transform(trimUuidNullable)
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsString()
  @MinLength(3)
  localityId?: string | null;

  @IsOptional()
  @Transform(trimUuidNullable)
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsString()
  @MinLength(3)
  specialtyId?: string | null;

  @IsOptional()
  @Transform(trimUuidNullable)
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsString()
  @MinLength(3)
  eloRoleId?: string | null;
}
