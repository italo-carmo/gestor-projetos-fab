import { SmifComplaintStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ListSmifComplaintDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(SmifComplaintStatus)
  status?: SmifComplaintStatus;

  @IsOptional()
  @IsString()
  localityId?: string;
}
