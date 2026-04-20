import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCpcaPresidentNominationRequestDto {
  @IsString()
  @MaxLength(120)
  identifier: string;

  @IsOptional()
  @IsString()
  localityId?: string;

  @IsOptional()
  @IsBoolean()
  isSubstitution?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  bulletinNumber?: string;
}
