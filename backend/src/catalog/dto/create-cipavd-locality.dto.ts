import { IsOptional, IsString } from 'class-validator';

export class CreateCipavdLocalityDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  uf?: string | null;
}
