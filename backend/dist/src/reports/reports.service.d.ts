import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RbacUser } from '../rbac/rbac.types';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
export declare class ReportsService {
    private readonly prisma;
    private readonly audit;
    private readonly jwt;
    private readonly config;
    constructor(prisma: PrismaService, audit: AuditService, jwt: JwtService, config: ConfigService);
    createReport(params: {
        taskInstanceId: string;
        fileName: string;
        fileUrl: string;
        storageKey?: string | null;
        mimeType?: string | null;
        fileSize?: number | null;
        checksum?: string | null;
    }, user?: RbacUser): Promise<{
        id: string;
        createdAt: Date;
        fileName: string;
        fileUrl: string;
        storageKey: string | null;
        mimeType: string | null;
        fileSize: number | null;
        checksum: string | null;
        taskInstanceId: string;
        approved: boolean;
    }>;
    getReport(id: string, user?: RbacUser): Promise<{
        id: string;
        createdAt: Date;
        fileName: string;
        fileUrl: string;
        storageKey: string | null;
        mimeType: string | null;
        fileSize: number | null;
        checksum: string | null;
        taskInstanceId: string;
        approved: boolean;
    }>;
    getSignedUrl(id: string, user?: RbacUser): Promise<{
        url: string;
        expiresIn: string;
    }>;
    verifyDownloadToken(token: string): Promise<string>;
    approveReport(id: string, approved: boolean, user?: RbacUser): Promise<{
        id: string;
        createdAt: Date;
        fileName: string;
        fileUrl: string;
        storageKey: string | null;
        mimeType: string | null;
        fileSize: number | null;
        checksum: string | null;
        taskInstanceId: string;
        approved: boolean;
    }>;
    private isTaskResponsible;
    private matchesTaskSpecialty;
    private assertTaskOperateAccess;
    private assertTaskViewAccess;
}
