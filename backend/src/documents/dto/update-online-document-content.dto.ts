import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateOnlineDocumentContentDto {
  @IsObject()
  contentJson!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(500_000)
  plainText?: string | null;

  @IsOptional()
  @IsObject()
  pageSettingsJson?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  versionTitle?: string | null;
}
