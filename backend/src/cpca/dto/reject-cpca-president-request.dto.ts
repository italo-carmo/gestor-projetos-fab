import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectCpcaPresidentRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(320)
  notes?: string;
}
