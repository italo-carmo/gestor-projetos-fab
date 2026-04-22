import { IsString, MaxLength } from 'class-validator';

export class UpdateCpcaCaseCipavdThreadDto {
  @IsString()
  @MaxLength(4000)
  text!: string;
}
