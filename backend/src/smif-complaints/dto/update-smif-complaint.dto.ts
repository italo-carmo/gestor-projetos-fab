import { SmifComplaintStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSmifComplaintDto {
  @IsOptional()
  @IsString()
  localityId?: string;

  @IsOptional()
  @IsDateString()
  reportedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsEnum(SmifComplaintStatus)
  status?: SmifComplaintStatus;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  conclusion?: string;
}
