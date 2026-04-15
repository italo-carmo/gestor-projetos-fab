import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateCpcaCommissionCoverageDto {
  @IsString()
  localityId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  managedLocalityIds?: string[];
}
