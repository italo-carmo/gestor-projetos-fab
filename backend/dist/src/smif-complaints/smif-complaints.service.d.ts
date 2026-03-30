import { SmifComplaintStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { RbacUser } from '../rbac/rbac.types';
export declare class SmifComplaintsService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    list(filters: {
        q?: string;
        status?: SmifComplaintStatus;
        localityId?: string;
    }, user?: RbacUser): Promise<{
        items: ({
            locality: {
                id: string;
                name: string;
                code: string;
            };
            createdBy: {
                id: string;
                name: string;
            };
            updatedBy: {
                id: string;
                name: string;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string;
            localityId: string;
            status: import("@prisma/client").$Enums.SmifComplaintStatus;
            createdById: string;
            conclusion: string | null;
            reportedAt: Date;
            updatedById: string | null;
        })[];
    }>;
    create(payload: {
        localityId: string;
        reportedAt: string;
        description: string;
        status?: SmifComplaintStatus;
        conclusion?: string;
    }, user?: RbacUser): Promise<{
        locality: {
            id: string;
            name: string;
            code: string;
        };
        createdBy: {
            id: string;
            name: string;
        };
        updatedBy: {
            id: string;
            name: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        localityId: string;
        status: import("@prisma/client").$Enums.SmifComplaintStatus;
        createdById: string;
        conclusion: string | null;
        reportedAt: Date;
        updatedById: string | null;
    }>;
    update(id: string, payload: {
        localityId?: string;
        reportedAt?: string;
        description?: string;
        status?: SmifComplaintStatus;
        conclusion?: string;
    }, user?: RbacUser): Promise<{
        locality: {
            id: string;
            name: string;
            code: string;
        };
        createdBy: {
            id: string;
            name: string;
        };
        updatedBy: {
            id: string;
            name: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        localityId: string;
        status: import("@prisma/client").$Enums.SmifComplaintStatus;
        createdById: string;
        conclusion: string | null;
        reportedAt: Date;
        updatedById: string | null;
    }>;
    remove(id: string, user?: RbacUser): Promise<{
        ok: boolean;
    }>;
    private assertEditorAccess;
    private resolveActorId;
    private normalizeDate;
    private normalizeRequiredText;
    private normalizeOptionalText;
    private resolveLocalityId;
}
