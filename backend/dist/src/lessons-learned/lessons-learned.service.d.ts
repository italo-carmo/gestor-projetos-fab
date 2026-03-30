import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { RbacUser } from '../rbac/rbac.types';
export declare class LessonsLearnedService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    list(filters: {
        q?: string;
        typeId?: string;
    }, user?: RbacUser): Promise<{
        items: ({
            type: {
                id: string;
                name: string;
                colorHex: string;
                textColorHex: string | null;
            };
            createdBy: {
                id: string;
                name: string;
            } | null;
        } & {
            id: string;
            title: string;
            createdAt: Date;
            updatedAt: Date;
            createdById: string | null;
            content: string;
            authorLabel: string | null;
            typeId: string;
        })[];
    }>;
    listTypes(user?: RbacUser): Promise<{
        items: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            colorHex: string;
            textColorHex: string | null;
        }[];
    }>;
    create(payload: {
        title: string;
        content: string;
        typeId: string;
    }, user?: RbacUser): Promise<{
        type: {
            id: string;
            name: string;
            colorHex: string;
            textColorHex: string | null;
        };
        createdBy: {
            id: string;
            name: string;
        } | null;
    } & {
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        createdById: string | null;
        content: string;
        authorLabel: string | null;
        typeId: string;
    }>;
    update(id: string, payload: {
        title?: string;
        content?: string;
        typeId?: string;
    }, user?: RbacUser): Promise<{
        type: {
            id: string;
            name: string;
            colorHex: string;
            textColorHex: string | null;
        };
        createdBy: {
            id: string;
            name: string;
        } | null;
    } & {
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        createdById: string | null;
        content: string;
        authorLabel: string | null;
        typeId: string;
    }>;
    remove(id: string, user?: RbacUser): Promise<{
        ok: boolean;
    }>;
    createType(payload: {
        name: string;
        colorHex: string;
        textColorHex?: string;
    }, user?: RbacUser): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        colorHex: string;
        textColorHex: string | null;
    }>;
    updateType(id: string, payload: {
        name?: string;
        colorHex?: string;
        textColorHex?: string;
    }, user?: RbacUser): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        colorHex: string;
        textColorHex: string | null;
    }>;
    removeType(id: string, user?: RbacUser): Promise<{
        ok: boolean;
    }>;
    private assertViewerAccess;
    private assertEditorAccess;
    private normalizeRequiredText;
    private buildAuthorLabel;
    private resolveTypeId;
    private normalizeColorHex;
}
