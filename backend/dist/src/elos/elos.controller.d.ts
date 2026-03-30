import type { RbacUser } from '../rbac/rbac.types';
import { ElosService } from './elos.service';
import { CreateEloDto } from './dto/create-elo.dto';
import { UpdateEloDto } from './dto/update-elo.dto';
import { CreateOrgChartAssignmentDto } from './dto/create-org-chart-assignment.dto';
import { UpdateOrgChartAssignmentDto } from './dto/update-org-chart-assignment.dto';
import { ManageOrgChartCommissionMemberDto } from './dto/manage-org-chart-commission-member.dto';
import { ReorderOrgChartCommissionMembersDto } from './dto/reorder-org-chart-commission-members.dto';
import { UpdateOrgChartCommissionMemberDto } from './dto/update-org-chart-commission-member.dto';
export declare class ElosController {
    private readonly elos;
    constructor(elos: ElosService);
    list(localityId: string | undefined, roleType: string | undefined, page: string | undefined, pageSize: string | undefined, user: RbacUser): Promise<{
        items: any[];
        page: number;
        pageSize: number;
        total: number;
        executive_hide_pii: boolean;
    }>;
    create(dto: CreateEloDto, user: RbacUser): Promise<any>;
    update(id: string, dto: UpdateEloDto, user: RbacUser): Promise<any>;
    remove(id: string, user: RbacUser): Promise<{
        ok: boolean;
    }>;
}
export declare class OrgChartController {
    private readonly elos;
    constructor(elos: ElosService);
    orgChart(localityId: string | undefined, roleType: string | undefined, user: RbacUser): Promise<{
        items: {
            localityId: string;
            localityName: string;
            localityCode: string;
            elos: any[];
        }[];
        executive_hide_pii: boolean;
    }>;
    candidates(localityId: string | undefined, eloRoleId: string | undefined, q: string | undefined, user: RbacUser): Promise<{
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
    commissionMembers(q: string | undefined, user: RbacUser): Promise<{
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
    commissionCandidates(q: string | undefined, user: RbacUser): Promise<{
        items: {
            id: string;
            name: string;
            email: string;
            ldapUid: string | null;
        }[];
    }>;
    addCommissionMember(dto: ManageOrgChartCommissionMemberDto, user: RbacUser): Promise<{
        ok: boolean;
        user: {
            id: string;
            name: string;
            warName: string;
            email: string;
        };
    }>;
    removeCommissionMember(userId: string, user: RbacUser): Promise<{
        ok: boolean;
        removed: number;
    }>;
    reorderCommissionMembers(dto: ReorderOrgChartCommissionMembersDto, user: RbacUser): Promise<{
        ok: boolean;
    }>;
    updateCommissionMember(userId: string, dto: UpdateOrgChartCommissionMemberDto, user: RbacUser): Promise<{
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
    createAssignment(dto: CreateOrgChartAssignmentDto, user: RbacUser): Promise<any>;
    updateAssignment(id: string, dto: UpdateOrgChartAssignmentDto, user: RbacUser): Promise<any>;
    removeAssignment(id: string, user: RbacUser): Promise<{
        ok: boolean;
    }>;
}
