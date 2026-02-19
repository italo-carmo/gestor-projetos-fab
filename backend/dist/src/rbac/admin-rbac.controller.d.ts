import { RbacService } from './rbac.service';
import type { RbacUser } from './rbac.types';
import { SetUserModuleAccessDto } from './dto/set-user-module-access.dto';
import { LookupLdapUserDto } from './dto/lookup-ldap-user.dto';
import { UpsertLdapUserDto } from './dto/upsert-ldap-user.dto';
export declare class AdminRbacController {
    private readonly rbac;
    constructor(rbac: RbacService);
    export(): Promise<{
        version: string;
        exportedAt: string;
        roles: {
            name: string;
            description: string | undefined;
            isSystemRole: boolean;
            wildcard: boolean;
            flags: string | number | boolean | import("@prisma/client/runtime/client").JsonObject | import("@prisma/client/runtime/client").JsonArray | undefined;
            permissions: {
                resource: string;
                action: string;
                scope: import("@prisma/client").$Enums.PermissionScope;
            }[];
            constraintsTemplate: string | number | boolean | import("@prisma/client/runtime/client").JsonObject | import("@prisma/client/runtime/client").JsonArray | undefined;
        }[];
    }>;
    import(body: any, user: RbacUser, mode?: 'replace' | 'merge'): Promise<{
        updatedRoles: number;
        createdRoles: number;
        warnings: never[];
    }>;
    simulate(userId?: string, roleId?: string): Promise<{
        source: string;
        id: string;
        permissions: {
            resource: string;
            action: string;
            scope: import("@prisma/client").PermissionScope;
        }[];
        moduleAccessOverrides: {
            resource: string;
            enabled: boolean;
        }[];
        wildcard?: undefined;
    } | {
        source: string;
        id: string;
        wildcard: boolean;
        permissions: {
            resource: string;
            action: string;
            scope: import("@prisma/client").PermissionScope;
        }[];
        moduleAccessOverrides?: undefined;
    }>;
    userModuleAccess(userId: string): Promise<{
        user: {
            id: string;
            name: string;
            email: string;
        };
        modules: {
            resource: string;
            baseEnabled: boolean;
            enabled: boolean;
            isOverridden: boolean;
            source: string;
        }[];
        summary: {
            total: number;
            enabled: number;
            overridden: number;
        };
    }>;
    setUserModuleAccess(userId: string, dto: SetUserModuleAccessDto, user: RbacUser): Promise<{
        user: {
            id: string;
            name: string;
            email: string;
        };
        modules: {
            resource: string;
            baseEnabled: boolean;
            enabled: boolean;
            isOverridden: boolean;
            source: string;
        }[];
        summary: {
            total: number;
            enabled: number;
            overridden: number;
        };
    }>;
    lookupLdapUser(query: LookupLdapUserDto): Promise<{
        user: {
            uid: string;
            dn: string;
            name: string | null;
            email: string | null;
            fabom: string | null;
        };
    }>;
    upsertLdapUser(dto: UpsertLdapUserDto, user: RbacUser): Promise<{
        user: {
            id: string;
            name: string;
            email: string;
            ldapUid: string | null;
            localityId: string | null;
            specialtyId: string | null;
            eloRoleId: string | null;
            roles: {
                id: string;
                name: string;
            }[];
        } | null;
    }>;
}
