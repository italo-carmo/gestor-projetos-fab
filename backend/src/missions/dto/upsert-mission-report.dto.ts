import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

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

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2_000)
  @IsString({ each: true })
  suppressedSourceKeys?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(400)
  @IsString({ each: true })
  suppressedDayKeys?: string[];
}
