import { IsOptional, IsString } from 'class-validator';

export class TaskSpecialtyDto {
  @IsOptional()
  @IsString()
  specialtyId?: string | null;
}
