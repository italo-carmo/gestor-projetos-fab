import { DocumentLinkEntity } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDocumentLinkDto {
  @IsString()
  documentId!: string;

  @IsEnum(DocumentLinkEntity)
  entityType!: DocumentLinkEntity;

  @IsString()
  entityId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  label?: string | null;
}
