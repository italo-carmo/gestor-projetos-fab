import { IsArray, IsString } from 'class-validator';

export class ReorderOrgChartCommissionMembersDto {
  @IsArray()
  @IsString({ each: true })
  userIds!: string[];
}

