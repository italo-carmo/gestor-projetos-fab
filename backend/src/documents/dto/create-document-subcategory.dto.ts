import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DocumentCategory } from '@prisma/client';

export class CreateDocumentSubcategoryDto {
  @IsEnum(DocumentCategory)
  category!: DocumentCategory;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  parentId?: string | null;
}
