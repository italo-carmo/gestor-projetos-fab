import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMissionChecklistClassificationDto {
  @IsString()
  @MaxLength(180)
  label: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  colorHex?: string;
}
