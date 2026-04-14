import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCpcaPresidentDto {
  @IsString()
  @MaxLength(120)
  identifier: string;

  @IsString()
  localityId: string;

  @IsOptional()
  @IsBoolean()
  isSubstitution?: boolean;

  @IsOptional()
  @IsBoolean()
  proceedWithExistingPresident?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  designationBulletin?: string;
}
