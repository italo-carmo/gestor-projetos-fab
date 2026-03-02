import { DocumentLinkEntity } from '@prisma/client';
export declare class CreateDocumentLinkDto {
    documentId: string;
    entityType: DocumentLinkEntity;
    entityId: string;
    label?: string | null;
}
