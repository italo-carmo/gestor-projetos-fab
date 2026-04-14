import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCpcaCommissionMemberDto {
  @IsString()
  @MaxLength(120)
  identifier: string;

  @IsOptional()
  @IsString()
  localityId?: string;
}
