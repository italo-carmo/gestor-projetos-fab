import { DocumentCategory } from '@prisma/client';
export declare class CreateDocumentSubcategoryDto {
    category: DocumentCategory;
    name: string;
    parentId?: string | null;
}
