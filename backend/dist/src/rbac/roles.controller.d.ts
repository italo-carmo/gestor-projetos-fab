import { RbacService } from './rbac.service';
import { RoleDto } from './dto/role.dto';
import { RolePermissionsDto } from './dto/role-permissions.dto';
export declare class RolesController {
    private readonly rbac;
    constructor(rbac: RbacService);
    list(): Promise<{
        items: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            description: string | null;
            isSystemRole: boolean;
            wildcard: boolean;
            flagsJson: import("@prisma/client/runtime/client").JsonValue | null;
            constraintsTemplateJson: import("@prisma/client/runtime/client").JsonValue | null;
        }[];
    }>;
    create(dto: RoleDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        isSystemRole: boolean;
        wildcard: boolean;
        flagsJson: import("@prisma/client/runtime/client").JsonValue | null;
        constraintsTemplateJson: import("@prisma/client/runtime/client").JsonValue | null;
    }>;
    update(id: string, dto: RoleDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        isSystemRole: boolean;
        wildcard: boolean;
        flagsJson: import("@prisma/client/runtime/client").JsonValue | null;
        constraintsTemplateJson: import("@prisma/client/runtime/client").JsonValue | null;
    }>;
    remove(id: string): Promise<void>;
    clone(id: string, body?: {
        name?: string;
        description?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        isSystemRole: boolean;
        wildcard: boolean;
        flagsJson: import("@prisma/client/runtime/client").JsonValue | null;
        constraintsTemplateJson: import("@prisma/client/runtime/client").JsonValue | null;
    }>;
    setPermissions(id: string, dto: RolePermissionsDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        isSystemRole: boolean;
        wildcard: boolean;
        flagsJson: import("@prisma/client/runtime/client").JsonValue | null;
        constraintsTemplateJson: import("@prisma/client/runtime/client").JsonValue | null;
    } | null>;
}
