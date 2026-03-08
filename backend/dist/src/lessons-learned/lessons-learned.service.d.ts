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
        items: any;
    }>;
    listTypes(user?: RbacUser): Promise<{
        items: any;
    }>;
    create(payload: {
        title: string;
        content: string;
        typeId: string;
    }, user?: RbacUser): Promise<any>;
    update(id: string, payload: {
        title?: string;
        content?: string;
        typeId?: string;
    }, user?: RbacUser): Promise<any>;
    remove(id: string, user?: RbacUser): Promise<{
        ok: boolean;
    }>;
    createType(payload: {
        name: string;
        colorHex: string;
        textColorHex?: string;
    }, user?: RbacUser): Promise<any>;
    updateType(id: string, payload: {
        name?: string;
        colorHex?: string;
        textColorHex?: string;
    }, user?: RbacUser): Promise<any>;
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
