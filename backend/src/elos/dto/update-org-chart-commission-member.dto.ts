import { IsOptional, IsString } from 'class-validator';

export class UpdateOrgChartCommissionMemberDto {
  @IsOptional()
  @IsString()
  functionText?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;
}
