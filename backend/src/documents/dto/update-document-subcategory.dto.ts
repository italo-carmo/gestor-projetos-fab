import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateDocumentSubcategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  parentId?: string | null;
}
