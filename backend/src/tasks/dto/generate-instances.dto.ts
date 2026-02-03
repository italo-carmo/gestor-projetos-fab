import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class GenerateInstancesDto {
  @IsArray()
  localities: { localityId: string; dueDate: string }[];

  @IsOptional()
  @IsBoolean()
  reportRequired?: boolean;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  meetingId?: string | null;

  @IsOptional()
  @IsString()
  assignedToId?: string | null;
}
