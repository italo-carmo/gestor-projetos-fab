import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { RbacUser } from '../rbac/rbac.types';
export declare class BestPracticesService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    list(filters: {
        q?: string;
        localityId?: string;
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
        localityId?: string | null;
        isCommission?: boolean;
        typeId?: string | null;
    }, user?: RbacUser): Promise<any>;
    update(id: string, payload: {
        title?: string;
        content?: string;
        localityId?: string | null;
        isCommission?: boolean;
        typeId?: string | null;
    }, user?: RbacUser): Promise<any>;
    remove(id: string, user?: RbacUser): Promise<{
        ok: boolean;
    }>;
    private assertViewerAccess;
    private assertUpdaterAccess;
    private assertDeleteAccess;
    private assertCreatorAccess;
    private resolveTypeTarget;
    private resolveLocalityTarget;
    private normalizeRequiredText;
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
    private assertTypeEditorAccess;
    private normalizeColorHex;
    private buildAuthorLabel;
}
