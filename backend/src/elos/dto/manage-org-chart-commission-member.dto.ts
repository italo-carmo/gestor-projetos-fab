import { IsString } from 'class-validator';

export class ManageOrgChartCommissionMemberDto {
  @IsString()
  userId!: string;
}
