import { PrismaService } from '../prisma/prisma.service';
import { RbacUser } from '../rbac/rbac.types';
import { AuditService } from '../audit/audit.service';
export declare class ElosService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    list(filters: {
        localityId?: string;
        roleType?: string;
        eloRoleId?: string;
        page?: string;
        pageSize?: string;
    }, user?: RbacUser): Promise<{
        items: any[];
        page: number;
        pageSize: number;
        total: number;
        executive_hide_pii: boolean;
    }>;
    create(payload: {
        localityId: string;
        eloRoleId: string;
        name: string;
        rank?: string | null;
        phone?: string | null;
        email?: string | null;
        om?: string | null;
    }, user?: RbacUser): Promise<any>;
    update(id: string, payload: {
        localityId?: string;
        eloRoleId?: string;
        name?: string;
        rank?: string | null;
        phone?: string | null;
        email?: string | null;
        om?: string | null;
    }, user?: RbacUser): Promise<any>;
    remove(id: string, user?: RbacUser): Promise<{
        ok: boolean;
    }>;
    orgChart(filters: {
        localityId?: string;
        roleType?: string;
        eloRoleId?: string;
    }, user?: RbacUser): Promise<{
        items: {
            localityName: string;
            elos: any[];
        }[];
        executive_hide_pii: boolean;
    }>;
    private getScopeConstraints;
    private assertConstraints;
    private mapElo;
}
