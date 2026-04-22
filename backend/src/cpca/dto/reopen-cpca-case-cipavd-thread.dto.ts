import { IsString, MaxLength } from 'class-validator';

export class ReopenCpcaCaseCipavdThreadDto {
  @IsString()
  @MaxLength(4000)
  text!: string;
}
