import { AuditService } from './audit.service';
export declare class AuditController {
    private readonly audit;
    constructor(audit: AuditService);
    list(resource: string | undefined, userId: string | undefined, localityId: string | undefined, entityId: string | undefined, from: string | undefined, to: string | undefined, page: string | undefined, pageSize: string | undefined): Promise<{
        items: ({
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
            user: {
                id: string;
                specialtyId: string | null;
                eloRoleId: string | null;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                flagsJson: import("@prisma/client/runtime/client").JsonValue | null;
                email: string;
                passwordHash: string;
                isActive: boolean;
                executiveHidePii: boolean;
                loginFailedCount: number;
                lockUntil: Date | null;
                localityId: string | null;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            resource: string;
            action: string;
            localityId: string | null;
            userId: string | null;
            entityId: string | null;
            diffJson: import("@prisma/client/runtime/client").JsonValue | null;
        })[];
        page: number;
        pageSize: number;
        total: number;
    }>;
}
