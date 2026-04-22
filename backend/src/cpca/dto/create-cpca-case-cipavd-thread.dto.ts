import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCpcaCaseCipavdThreadDto {
  @IsString()
  @MaxLength(4000)
  text!: string;

  @IsOptional()
  @IsBoolean()
  isPending?: boolean;
}
