import { IsBoolean, IsString, MaxLength } from 'class-validator';

export class CreateCpcaPresidentSelfRegistrationDto {
  @IsString()
  @MaxLength(120)
  identifier: string;

  @IsString()
  localityId: string;

  @IsBoolean()
  isSubstitution: boolean;

  @IsString()
  @MaxLength(220)
  bulletinNumber: string;
}
