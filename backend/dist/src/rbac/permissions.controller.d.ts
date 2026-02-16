import { RbacService } from './rbac.service';
export declare class PermissionsController {
    private readonly rbac;
    constructor(rbac: RbacService);
    list(): Promise<{
        items: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            resource: string;
            action: string;
            scope: import("@prisma/client").$Enums.PermissionScope;
            description: string | null;
        }[];
    }>;
}
