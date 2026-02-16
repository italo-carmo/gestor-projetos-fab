import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePhaseDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string | null;
}

