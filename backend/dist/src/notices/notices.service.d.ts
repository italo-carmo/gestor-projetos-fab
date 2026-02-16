import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RbacUser } from '../rbac/rbac.types';
export declare class NoticesService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    list(filters: {
        localityId?: string;
        specialtyId?: string;
        pinned?: string;
        priority?: string;
        dueFrom?: string;
        dueTo?: string;
        page?: string;
        pageSize?: string;
    }, user?: RbacUser): Promise<{
        items: {
            isLate: boolean;
            id: string;
            title: string;
            specialtyId: string | null;
            createdAt: Date;
            updatedAt: Date;
            localityId: string | null;
            dueDate: Date | null;
            priority: import("@prisma/client").$Enums.NoticePriority;
            body: string;
            pinned: boolean;
        }[];
        page: number;
        pageSize: number;
        total: number;
    }>;
    create(payload: {
        title: string;
        body: string;
        localityId?: string | null;
        specialtyId?: string | null;
        dueDate?: string | null;
        priority?: string;
        pinned?: boolean;
    }, user?: RbacUser): Promise<{
        id: string;
        title: string;
        specialtyId: string | null;
        createdAt: Date;
        updatedAt: Date;
        localityId: string | null;
        dueDate: Date | null;
        priority: import("@prisma/client").$Enums.NoticePriority;
        body: string;
        pinned: boolean;
    }>;
    update(id: string, payload: {
        title?: string;
        body?: string;
        localityId?: string | null;
        specialtyId?: string | null;
        dueDate?: string | null;
        priority?: string;
        pinned?: boolean;
    }, user?: RbacUser): Promise<{
        id: string;
        title: string;
        specialtyId: string | null;
        createdAt: Date;
        updatedAt: Date;
        localityId: string | null;
        dueDate: Date | null;
        priority: import("@prisma/client").$Enums.NoticePriority;
        body: string;
        pinned: boolean;
    }>;
    remove(id: string, user?: RbacUser): Promise<{
        ok: boolean;
    }>;
    pin(id: string, pinned: boolean, user?: RbacUser): Promise<{
        id: string;
        title: string;
        specialtyId: string | null;
        createdAt: Date;
        updatedAt: Date;
        localityId: string | null;
        dueDate: Date | null;
        priority: import("@prisma/client").$Enums.NoticePriority;
        body: string;
        pinned: boolean;
    }>;
    private getScopeConstraints;
    private assertConstraints;
}
