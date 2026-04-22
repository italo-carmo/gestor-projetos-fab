import { IsString, MaxLength } from 'class-validator';

export class FinalizeCpcaCaseCipavdThreadDto {
  @IsString()
  @MaxLength(4000)
  text!: string;
}
