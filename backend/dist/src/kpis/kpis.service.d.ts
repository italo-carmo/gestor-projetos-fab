import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RbacUser } from '../rbac/rbac.types';
export declare class KpisService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(user?: RbacUser): Promise<{
        items: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            label: string;
            key: string;
            visibility: import("@prisma/client").$Enums.KpiVisibility;
        }[];
    }>;
    create(payload: {
        key: string;
        label: string;
        visibility: string;
    }): Prisma.Prisma__KpiClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        label: string;
        key: string;
        visibility: import("@prisma/client").$Enums.KpiVisibility;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, Prisma.PrismaClientOptions>;
    addValue(kpiId: string, payload: {
        date: string;
        value: number;
        localityId?: string | null;
        specialtyId?: string | null;
    }): Prisma.Prisma__KpiValueClient<{
        id: string;
        specialtyId: string | null;
        createdAt: Date;
        localityId: string | null;
        value: number;
        date: Date;
        kpiId: string;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, Prisma.PrismaClientOptions>;
    dashboard(filters: {
        from?: string;
        to?: string;
    }, user?: RbacUser): Promise<{
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
