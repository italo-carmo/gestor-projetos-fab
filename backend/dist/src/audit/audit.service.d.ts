import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
export declare class AuditService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    log(params: {
        userId?: string | null;
        localityId?: string | null;
        resource: string;
        action: string;
        entityId?: string | null;
        diffJson?: Record<string, unknown> | null;
    }): Promise<{
        id: string;
        createdAt: Date;
        resource: string;
        action: string;
        localityId: string | null;
        userId: string | null;
        entityId: string | null;
        diffJson: Prisma.JsonValue | null;
    }>;
    private truncateDiff;
    list(filters: {
        resource?: string;
        userId?: string;
        localityId?: string;
        entityId?: string;
        from?: string;
        to?: string;
        page?: string;
        pageSize?: string;
    }): Promise<{
        items: ({
            user: {
                id: string;
                specialtyId: string | null;
                eloRoleId: string | null;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                flagsJson: Prisma.JsonValue | null;
                email: string;
                ldapUid: string | null;
                passwordHash: string;
                isActive: boolean;
                executiveHidePii: boolean;
                loginFailedCount: number;
                lockUntil: Date | null;
                localityId: string | null;
            } | null;
            locality: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                code: string;
                commandName: string | null;
                commanderName: string | null;
                individualMeetingDate: Date | null;
                visitDate: Date | null;
                recruitsFemaleCountCurrent: number | null;
                notes: string | null;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            resource: string;
            action: string;
            localityId: string | null;
            userId: string | null;
            entityId: string | null;
            diffJson: Prisma.JsonValue | null;
        })[];
        page: number;
        pageSize: number;
        total: number;
    }>;
}
