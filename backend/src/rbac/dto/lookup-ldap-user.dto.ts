import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';

export class LookupLdapUserDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  uid!: string;
}
