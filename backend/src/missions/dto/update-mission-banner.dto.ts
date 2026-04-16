import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateMissionBannerDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  eventDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  eventTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  locationPrimary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  locationSecondary?: string;
}
