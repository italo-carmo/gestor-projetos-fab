import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdatePostoDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
