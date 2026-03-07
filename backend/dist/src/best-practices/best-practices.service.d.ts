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
    }, user?: RbacUser): Promise<{
        items: any;
    }>;
    create(payload: {
        title: string;
        content: string;
        localityId?: string | null;
        isCommission?: boolean;
    }, user?: RbacUser): Promise<any>;
    update(id: string, payload: {
        title?: string;
        content?: string;
        localityId?: string | null;
        isCommission?: boolean;
    }, user?: RbacUser): Promise<any>;
    remove(id: string, user?: RbacUser): Promise<{
        ok: boolean;
    }>;
    private assertViewerAccess;
    private assertEditorAccess;
    private resolveLocalityTarget;
    private normalizeRequiredText;
    private buildAuthorLabel;
}
