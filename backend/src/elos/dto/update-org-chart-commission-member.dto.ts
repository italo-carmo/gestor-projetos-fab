import { IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class UpdateOrgChartCommissionMemberDto {
  @IsOptional()
  @IsString()
  functionText?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seniority?: number | null;
}
