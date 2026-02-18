import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateDocumentLinkDto {
  @IsOptional()
  @IsString()
  documentId?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  label?: string | null;
}
