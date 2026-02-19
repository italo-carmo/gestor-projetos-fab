import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { RbacService } from '../rbac/rbac.service';
import { FabLdapService } from '../ldap/fab-ldap.service';
export declare class AuthService {
    private readonly users;
    private readonly prisma;
    private readonly jwt;
    private readonly config;
    private readonly audit;
    private readonly rbac;
    private readonly fabLdap;
    constructor(users: UsersService, prisma: PrismaService, jwt: JwtService, config: ConfigService, audit: AuditService, rbac: RbacService, fabLdap: FabLdapService);
    login(login: string, password: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            name: string;
            email: string;
            role: {
                id: string;
                name: string;
            } | undefined;
        };
    }>;
    refresh(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    me(userId: string): Promise<{
        id: string;
        email: string;
        name: string;
        localityId: string | null;
        executive_hide_pii: boolean;
        elo_role_id: string | null;
        roles: {
            id: string;
            name: string;
        }[];
        permissions: {
            resource: string;
            action: string;
            scope: import("@prisma/client").PermissionScope;
        }[];
        scopes: never[];
        flags: {
            executive_hide_pii: boolean;
        };
    }>;
    private issueTokens;
    private getRefreshTtlMs;
    private registerFailedLogin;
    private registerSuccessfulLogin;
    private getHttpErrorCode;
}
