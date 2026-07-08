import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertMissionReportDto {
  @IsOptional()
  @IsString()
  @MaxLength(120_000)
  contentHtml?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120_000)
  contentText?: string;

  @IsOptional()
  @IsArray()
  blocks?: unknown[];
}
