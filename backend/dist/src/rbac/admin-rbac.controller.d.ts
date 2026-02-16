import { RbacService } from './rbac.service';
import type { RbacUser } from './rbac.types';
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
            scope: import("@prisma/client").$Enums.PermissionScope;
        }[];
    }>;
}
