import { IsString, MaxLength } from 'class-validator';

export class ResolveCpcaCaseCipavdThreadDto {
  @IsString()
  @MaxLength(4000)
  text!: string;
}
