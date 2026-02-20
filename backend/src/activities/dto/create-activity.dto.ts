import { IsArray, IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateActivityDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  localityId?: string | null;

  @IsOptional()
  @IsString()
  specialtyId?: string | null;

  @IsOptional()
  @IsDateString()
  eventDate?: string | null;

  @IsOptional()
  @IsBoolean()
  reportRequired?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  responsibleUserIds?: string[];
}
