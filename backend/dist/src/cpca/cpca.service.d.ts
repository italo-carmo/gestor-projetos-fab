import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RbacUser } from '../rbac/rbac.types';
import { CreateCpcaCaseDto } from './dto/create-cpca-case.dto';
import { UpdateCpcaCaseDto } from './dto/update-cpca-case.dto';
export declare class CpcaService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    list(filters: {
        localityId?: string;
        status?: string;
        complaintType?: string;
        detailedViolenceType?: string;
        procedureType?: string;
        q?: string;
        page?: string;
        pageSize?: string;
    }, user?: RbacUser): Promise<{
        items: any;
        page: number;
        pageSize: number;
        total: any;
    }>;
    stats(filters: {
        localityId?: string;
        from?: string;
        to?: string;
    }, user?: RbacUser): Promise<{
        filters: {
            localityId: any;
            from: string | null;
            to: string | null;
        };
        generatedAt: string;
        summary: {
            totalCases: any;
            openCases: number;
            concludedCases: number;
            archivedCases: number;
            closureRatePercent: number;
            averageDaysToClosure: number;
            moralCases: number;
            sexualCases: number;
            retaliationRiskCases: number;
            triageOver7Days: number;
            investigationOver30Days: number;
            stalledOver30Days: number;
            stalledOver60Days: number;
            noUpdateOver14Days: number;
        };
        statusDistribution: {
            status: string;
            count: number;
        }[];
        procedureDistribution: {
            procedureType: string;
            count: number;
        }[];
        complaintTypeDistribution: {
            complaintType: string;
            count: number;
        }[];
        detailedTypeDistribution: {
            [x: string]: string | number;
            count: number;
        }[];
        aggressorAgeRangeDistribution: {
            [x: string]: string | number;
            count: number;
        }[];
        victimAgeRangeDistribution: {
            [x: string]: string | number;
            count: number;
        }[];
        monthlyTrend: {
            month: string;
            total: number;
            moral: number;
            sexual: number;
            open: number;
        }[];
        openByAgeBuckets: {
            bucket: string;
            count: number;
        }[];
        topRiskLocalities: {
            averageOpenDays: number;
            riskScore: number;
            localityId: string;
            localityCode: string;
            localityName: string;
            totalCases: number;
            openCases: number;
            sexualCases: number;
            retaliationRiskCases: number;
            stalledOver30Days: number;
            openDaysTotal: number;
        }[];
        topAggressorRanks: {
            rank: string;
            count: number;
        }[];
        topVictimRanks: {
            rank: string;
            count: number;
        }[];
        criticalOpenCases: {
            caseId: string;
            caseNumber: string;
            localityId: string;
            localityCode: string;
            localityName: string;
            status: string;
            complaintType: string;
            detailedViolenceType: string;
            reportedAt: string;
            openDays: number;
            idleDays: number;
            retaliationRisk: boolean;
        }[];
        kpiDetails: {
            totalCases: any;
            openCases: any;
            closureRate: any;
            averageClosureTime: any;
            triageOver7Days: any;
            investigationOver30Days: any;
        };
    }>;
    getById(id: string, user?: RbacUser): Promise<any>;
    create(payload: CreateCpcaCaseDto, user?: RbacUser): Promise<any>;
    update(id: string, payload: UpdateCpcaCaseDto, user?: RbacUser): Promise<any>;
    addComment(id: string, text: string, user?: RbacUser): Promise<any>;
    listComments(id: string, user?: RbacUser): Promise<{
        items: any;
    }>;
    private getScopeConstraints;
    private hasWorkflowAccess;
    private assertCaseAccess;
    private resolveTargetLocalityId;
    private cleanText;
    private cleanOptional;
    private parseDateBoundary;
    private daysBetween;
    private normalizeRankForStats;
    private toTopRankDistribution;
    private toSortedGenericDistribution;
    private assertIcaConsistency;
    private assertStatusTransition;
    private requireUserId;
    private generateCaseNumber;
    private isCaseNumberConflict;
}
