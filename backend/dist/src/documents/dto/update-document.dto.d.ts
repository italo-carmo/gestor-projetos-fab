import { DocumentCategory } from '@prisma/client';
export declare class UpdateDocumentDto {
    title?: string;
    category?: DocumentCategory;
    sourcePath?: string;
    localityId?: string | null;
    subcategoryId?: string | null;
}
