import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trimText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateOdgsaDto {
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  code?: string;

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  name?: string;
}
