import { IsOptional, IsString } from 'class-validator';

export class CreateSpecialtyDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  color?: string | null;

  @IsOptional()
  @IsString()
  icon?: string | null;
}

