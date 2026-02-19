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
        userId?: string;
        rank?: string | null;
        phone?: string | null;
        email?: string | null;
        om?: string | null;
    }, user?: RbacUser): Promise<any>;
    update(id: string, payload: {
        localityId?: string;
        eloRoleId?: string;
        name?: string;
        userId?: string;
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
            localityId: string;
            localityName: string;
            localityCode: string;
            elos: any[];
        }[];
        executive_hide_pii: boolean;
    }>;
    listOrgChartCandidates(filters: {
        localityId?: string;
        eloRoleId?: string;
        q?: string;
    }, user?: RbacUser): Promise<{
        items: {
            id: string;
            eloRoleId: string | null;
            eloRole: {
                id: string;
                name: string;
                code: string;
            } | null;
            name: string;
            locality: {
                id: string;
                name: string;
                code: string;
            } | null;
            email: string;
            localityId: string | null;
        }[];
    }>;
    createOrgChartAssignment(payload: {
        localityId: string;
        eloRoleId: string;
        userId: string;
        rank?: string | null;
        phone?: string | null;
        om?: string | null;
    }, user?: RbacUser): Promise<any>;
    updateOrgChartAssignment(id: string, payload: {
        localityId?: string;
        eloRoleId?: string;
        userId?: string;
        rank?: string | null;
        phone?: string | null;
        om?: string | null;
    }, user?: RbacUser): Promise<any>;
    removeOrgChartAssignment(id: string, user?: RbacUser): Promise<{
        ok: boolean;
    }>;
    private getScopeConstraints;
    private assertConstraints;
    private assertCanManageOrgChart;
    private assertUserMatchesAssignment;
    private buildEloMatchKey;
    private mapElo;
}
