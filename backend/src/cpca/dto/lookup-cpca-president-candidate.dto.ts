import { IsString, MaxLength } from 'class-validator';

export class LookupCpcaPresidentCandidateDto {
  @IsString()
  @MaxLength(120)
  identifier: string;
}
