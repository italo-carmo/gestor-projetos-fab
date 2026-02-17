import { PermissionScope, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RbacUser } from './rbac.types';
type PermissionEntry = {
    resource: string;
    action: string;
    scope: PermissionScope;
};
export declare class RbacService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    getUserAccess(userId: string): Promise<RbacUser>;
    listRoles(): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        isSystemRole: boolean;
        wildcard: boolean;
        flagsJson: Prisma.JsonValue | null;
        constraintsTemplateJson: Prisma.JsonValue | null;
    }[]>;
    createRole(data: Prisma.RoleCreateInput): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        isSystemRole: boolean;
        wildcard: boolean;
        flagsJson: Prisma.JsonValue | null;
        constraintsTemplateJson: Prisma.JsonValue | null;
    }>;
    updateRole(id: string, data: Prisma.RoleUpdateInput): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        isSystemRole: boolean;
        wildcard: boolean;
        flagsJson: Prisma.JsonValue | null;
        constraintsTemplateJson: Prisma.JsonValue | null;
    }>;
    deleteRole(id: string): Promise<void>;
    cloneRole(id: string, name?: string, description?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        isSystemRole: boolean;
        wildcard: boolean;
        flagsJson: Prisma.JsonValue | null;
        constraintsTemplateJson: Prisma.JsonValue | null;
    }>;
    listPermissions(): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        resource: string;
        action: string;
        scope: import("@prisma/client").$Enums.PermissionScope;
        description: string | null;
    }[]>;
    setRolePermissions(roleId: string, permissions: {
        resource: string;
        action: string;
        scope: PermissionScope;
    }[]): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        isSystemRole: boolean;
        wildcard: boolean;
        flagsJson: Prisma.JsonValue | null;
        constraintsTemplateJson: Prisma.JsonValue | null;
    } | null>;
    exportMatrix(): Promise<{
        version: string;
        exportedAt: string;
        roles: {
            name: string;
            description: string | undefined;
            isSystemRole: boolean;
            wildcard: boolean;
            flags: string | number | boolean | Prisma.JsonObject | Prisma.JsonArray | undefined;
            permissions: {
                resource: string;
                action: string;
                scope: import("@prisma/client").$Enums.PermissionScope;
            }[];
            constraintsTemplate: string | number | boolean | Prisma.JsonObject | Prisma.JsonArray | undefined;
        }[];
    }>;
    importMatrix(payload: any, mode?: 'replace' | 'merge', userId?: string): Promise<{
        updatedRoles: number;
        createdRoles: number;
        warnings: never[];
    }>;
    getUserModuleAccess(userId: string): Promise<{
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
    setUserModuleAccess(userId: string, payload: {
        resource: string;
        enabled: boolean;
    }, actorUserId?: string): Promise<{
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
    simulateAccess(params: {
        userId?: string;
        roleId?: string;
    }): Promise<{
        source: string;
        id: string;
        permissions: {
            resource: string;
            action: string;
            scope: PermissionScope;
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
        permissions: PermissionEntry[];
        moduleAccessOverrides?: undefined;
    }>;
    private buildAccessFromUser;
    private listPermissionEntries;
    private listPermissionResources;
    private dedupePermissions;
    private applyModuleAccessOverrides;
}
export {};
