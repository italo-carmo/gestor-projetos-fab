import { PrismaService } from '../prisma/prisma.service';
export declare class UsersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private readonly authInclude;
    findByEmail(email: string): import("@prisma/client").Prisma.Prisma__UserClient<({
        roles: ({
            role: {
                permissions: ({
                    permission: {
                        id: string;
                        createdAt: Date;
                        updatedAt: Date;
                        resource: string;
                        action: string;
                        scope: import("@prisma/client").$Enums.PermissionScope;
                        description: string | null;
                    };
                } & {
                    id: string;
                    roleId: string;
                    permissionId: string;
                })[];
            } & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                description: string | null;
                isSystemRole: boolean;
                wildcard: boolean;
                flagsJson: import("@prisma/client/runtime/client").JsonValue | null;
                constraintsTemplateJson: import("@prisma/client/runtime/client").JsonValue | null;
            };
        } & {
            id: string;
            roleId: string;
            userId: string;
        })[];
    } & {
        id: string;
        specialtyId: string | null;
        eloRoleId: string | null;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        flagsJson: import("@prisma/client/runtime/client").JsonValue | null;
        email: string;
        ldapUid: string | null;
        passwordHash: string;
        isActive: boolean;
        executiveHidePii: boolean;
        loginFailedCount: number;
        lockUntil: Date | null;
        localityId: string | null;
    }) | null, null, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    findByLdapUid(ldapUid: string): import("@prisma/client").Prisma.Prisma__UserClient<({
        roles: ({
            role: {
                permissions: ({
                    permission: {
                        id: string;
                        createdAt: Date;
                        updatedAt: Date;
                        resource: string;
                        action: string;
                        scope: import("@prisma/client").$Enums.PermissionScope;
                        description: string | null;
                    };
                } & {
                    id: string;
                    roleId: string;
                    permissionId: string;
                })[];
            } & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                description: string | null;
                isSystemRole: boolean;
                wildcard: boolean;
                flagsJson: import("@prisma/client/runtime/client").JsonValue | null;
                constraintsTemplateJson: import("@prisma/client/runtime/client").JsonValue | null;
            };
        } & {
            id: string;
            roleId: string;
            userId: string;
        })[];
    } & {
        id: string;
        specialtyId: string | null;
        eloRoleId: string | null;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        flagsJson: import("@prisma/client/runtime/client").JsonValue | null;
        email: string;
        ldapUid: string | null;
        passwordHash: string;
        isActive: boolean;
        executiveHidePii: boolean;
        loginFailedCount: number;
        lockUntil: Date | null;
        localityId: string | null;
    }) | null, null, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    findForAuth(identifier: string): import("@prisma/client").Prisma.Prisma__UserClient<({
        roles: ({
            role: {
                permissions: ({
                    permission: {
                        id: string;
                        createdAt: Date;
                        updatedAt: Date;
                        resource: string;
                        action: string;
                        scope: import("@prisma/client").$Enums.PermissionScope;
                        description: string | null;
                    };
                } & {
                    id: string;
                    roleId: string;
                    permissionId: string;
                })[];
            } & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                description: string | null;
                isSystemRole: boolean;
                wildcard: boolean;
                flagsJson: import("@prisma/client/runtime/client").JsonValue | null;
                constraintsTemplateJson: import("@prisma/client/runtime/client").JsonValue | null;
            };
        } & {
            id: string;
            roleId: string;
            userId: string;
        })[];
    } & {
        id: string;
        specialtyId: string | null;
        eloRoleId: string | null;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        flagsJson: import("@prisma/client/runtime/client").JsonValue | null;
        email: string;
        ldapUid: string | null;
        passwordHash: string;
        isActive: boolean;
        executiveHidePii: boolean;
        loginFailedCount: number;
        lockUntil: Date | null;
        localityId: string | null;
    }) | null, null, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    findById(id: string): import("@prisma/client").Prisma.Prisma__UserClient<({
        roles: ({
            role: {
                permissions: ({
                    permission: {
                        id: string;
                        createdAt: Date;
                        updatedAt: Date;
                        resource: string;
                        action: string;
                        scope: import("@prisma/client").$Enums.PermissionScope;
                        description: string | null;
                    };
                } & {
                    id: string;
                    roleId: string;
                    permissionId: string;
                })[];
            } & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                description: string | null;
                isSystemRole: boolean;
                wildcard: boolean;
                flagsJson: import("@prisma/client/runtime/client").JsonValue | null;
                constraintsTemplateJson: import("@prisma/client/runtime/client").JsonValue | null;
            };
        } & {
            id: string;
            roleId: string;
            userId: string;
        })[];
    } & {
        id: string;
        specialtyId: string | null;
        eloRoleId: string | null;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        flagsJson: import("@prisma/client/runtime/client").JsonValue | null;
        email: string;
        ldapUid: string | null;
        passwordHash: string;
        isActive: boolean;
        executiveHidePii: boolean;
        loginFailedCount: number;
        lockUntil: Date | null;
        localityId: string | null;
    }) | null, null, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    list(): import("@prisma/client").Prisma.PrismaPromise<{
        id: string;
        specialtyId: string | null;
        eloRoleId: string | null;
        eloRole: {
            id: string;
            name: string;
            code: string;
        } | null;
        name: string;
        roles: {
            role: {
                id: string;
                name: string;
            };
        }[];
        email: string;
        ldapUid: string | null;
        localityId: string | null;
    }[]>;
    update(id: string, payload: {
        eloRoleId?: string | null;
    }): import("@prisma/client").Prisma.Prisma__UserClient<{
        id: string;
        specialtyId: string | null;
        eloRoleId: string | null;
        eloRole: {
            id: string;
            name: string;
            code: string;
        } | null;
        name: string;
        roles: {
            role: {
                id: string;
                name: string;
            };
        }[];
        email: string;
        ldapUid: string | null;
        localityId: string | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
}
