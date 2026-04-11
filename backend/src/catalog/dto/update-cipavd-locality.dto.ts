import { IsOptional, IsString } from 'class-validator';

export class UpdateCipavdLocalityDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  uf?: string | null;
}
