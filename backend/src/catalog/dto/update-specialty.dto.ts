import { IsOptional, IsString } from 'class-validator';

export class UpdateSpecialtyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  color?: string | null;

  @IsOptional()
  @IsString()
  icon?: string | null;
}

