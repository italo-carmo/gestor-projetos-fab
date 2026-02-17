import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DocumentCategory } from '@prisma/client';

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  title?: string;

  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;

  @IsOptional()
  @IsString()
  sourcePath?: string;

  @IsOptional()
  @IsString()
  localityId?: string | null;

  @IsOptional()
  @IsString()
  subcategoryId?: string | null;
}
