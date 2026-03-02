import type { RbacUser } from '../rbac/rbac.types';
import { AddCpcaCaseCommentDto } from './dto/add-cpca-case-comment.dto';
import { CreateCpcaCaseDto } from './dto/create-cpca-case.dto';
import { UpdateCpcaCaseDto } from './dto/update-cpca-case.dto';
import { CpcaService } from './cpca.service';
export declare class CpcaController {
    private readonly cpca;
    constructor(cpca: CpcaService);
    list(omId: string | undefined, localityId: string | undefined, status: string | undefined, complaintType: string | undefined, detailedViolenceType: string | undefined, procedureType: string | undefined, q: string | undefined, page: string | undefined, pageSize: string | undefined, user: RbacUser): Promise<{
        items: any;
        page: number;
        pageSize: number;
        total: any;
    }>;
    stats(omId: string | undefined, localityId: string | undefined, from: string | undefined, to: string | undefined, user: RbacUser): Promise<{
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
    }>;
    getById(id: string, user: RbacUser): Promise<any>;
    create(dto: CreateCpcaCaseDto, user: RbacUser): Promise<any>;
    update(id: string, dto: UpdateCpcaCaseDto, user: RbacUser): Promise<any>;
    comments(id: string, user: RbacUser): Promise<{
        items: any;
    }>;
    addComment(id: string, dto: AddCpcaCaseCommentDto, user: RbacUser): Promise<any>;
    private assertProcessAccess;
}
