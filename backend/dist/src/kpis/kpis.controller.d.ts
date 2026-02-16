import type { RbacUser } from '../rbac/rbac.types';
import { CreateKpiDto } from './dto/create-kpi.dto';
import { CreateKpiValueDto } from './dto/create-kpi-value.dto';
import { KpisService } from './kpis.service';
export declare class KpisController {
    private readonly kpis;
    constructor(kpis: KpisService);
    list(user: RbacUser): Promise<{
        items: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            key: string;
            label: string;
            visibility: import("@prisma/client").$Enums.KpiVisibility;
        }[];
    }>;
    create(dto: CreateKpiDto): import("@prisma/client").Prisma.Prisma__KpiClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        key: string;
        label: string;
        visibility: import("@prisma/client").$Enums.KpiVisibility;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    addValue(id: string, dto: CreateKpiValueDto): import("@prisma/client").Prisma.Prisma__KpiValueClient<{
        id: string;
        specialtyId: string | null;
        createdAt: Date;
        localityId: string | null;
        date: Date;
        value: number;
        kpiId: string;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    dashboard(from: string | undefined, to: string | undefined, user: RbacUser): Promise<{
        progress: {
            overall: number;
            byPhase: {
                phaseId: string;
                phaseName: import("@prisma/client").$Enums.PhaseName;
                progress: number;
            }[];
        };
        late: {
            total: number;
        };
        leadTime: {
            phaseId: string;
            phaseName: import("@prisma/client").$Enums.PhaseName;
            avgLeadDays: number;
        }[];
        reportsCompliance: {
            approved: number;
            pending: number;
            total: number;
        };
        localities: {
            id: string;
            code: string;
            name: string;
        }[];
    }>;
}
