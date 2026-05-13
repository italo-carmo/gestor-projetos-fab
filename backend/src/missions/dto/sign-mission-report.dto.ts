import { IsString, MaxLength } from 'class-validator';

export class SignMissionReportDto {
  @IsString()
  @MaxLength(12)
  totpCode: string;
}
