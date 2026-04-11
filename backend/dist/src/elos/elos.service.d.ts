import { PrismaService } from '../prisma/prisma.service';
import { RbacUser } from '../rbac/rbac.types';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
export declare class ElosService {
    private readonly prisma;
    private readonly audit;
    private readonly auth;
    constructor(prisma: PrismaService, audit: AuditService, auth: AuthService);
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
    listCommissionMembers(filters: {
        q?: string;
    }, _user?: RbacUser): Promise<{
        items: {
            id: string;
            name: string;
            warName: string;
            email: string;
            ldapUid: string | null;
            numeroOrdem: string | null;
            functionText: string | null;
            phone: string | null;
            seniority: number | null;
        }[];
    }>;
    listCommissionCandidates(filters: {
        q?: string;
    }, _user?: RbacUser): Promise<{
        items: {
            id: string;
            name: string;
            email: string;
            ldapUid: string | null;
        }[];
    }>;
    addCommissionMember(payload: {
        userId: string;
    }, user?: RbacUser): Promise<{
        ok: boolean;
        user: {
            id: string;
            name: string;
            warName: string;
            email: string;
        };
    }>;
    removeCommissionMember(payload: {
        userId: string;
    }, user?: RbacUser): Promise<{
        ok: boolean;
        removed: number;
    }>;
    updateCommissionMember(payload: {
        userId: string;
        functionText?: string | null;
        phone?: string | null;
        seniority?: number | null;
    }, user?: RbacUser): Promise<{
        ok: boolean;
        item: {
            id: string;
            name: string;
            warName: string;
            email: string;
            functionText: string | null;
            phone: string | null;
            seniority: number | null;
        };
    }>;
    reorderCommissionMembers(payload: {
        userIds: string[];
    }, user?: RbacUser): Promise<{
        ok: boolean;
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
    private hasNationalOrgChartScope;
    private getCommissionRole;
    private getCommissionRoleOrFail;
    private assertUserMatchesAssignment;
    private buildEloMatchKey;
    private maskCommissionPhone;
    private mapElo;
}
