"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RbacService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const http_error_1 = require("../common/http-error");
const audit_service_1 = require("../audit/audit.service");
let RbacService = class RbacService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async getUserAccess(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                roles: {
                    include: {
                        role: {
                            include: {
                                permissions: {
                                    include: { permission: true },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!user) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
        const roles = user.roles.map((userRole) => ({
            id: userRole.role.id,
            name: userRole.role.name,
            wildcard: userRole.role.wildcard,
            constraintsTemplateJson: userRole.role.constraintsTemplateJson,
            flagsJson: userRole.role.flagsJson,
            permissions: userRole.role.permissions.map((rp) => ({
                resource: rp.permission.resource,
                action: rp.permission.action,
                scope: rp.permission.scope,
            })),
        }));
        const executiveFromRole = roles.some((role) => role.flagsJson && role.flagsJson.executive_hide_pii === true);
        return {
            id: user.id,
            email: user.email,
            localityId: user.localityId,
            specialtyId: user.specialtyId,
            eloRoleId: user.eloRoleId,
            executiveHidePii: user.executiveHidePii || executiveFromRole,
            roles,
        };
    }
    async listRoles() {
        return this.prisma.role.findMany({ orderBy: { name: 'asc' } });
    }
    async createRole(data) {
        return this.prisma.role.create({ data });
    }
    async updateRole(id, data) {
        return this.prisma.role.update({ where: { id }, data });
    }
    async deleteRole(id) {
        const role = await this.prisma.role.findUnique({ where: { id } });
        if (!role)
            (0, http_error_1.throwError)('NOT_FOUND');
        if (role.isSystemRole) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'ROLE_IS_SYSTEM' });
        }
        await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
        await this.prisma.userRole.deleteMany({ where: { roleId: id } });
        await this.prisma.role.delete({ where: { id } });
    }
    async cloneRole(id, name, description) {
        const role = await this.prisma.role.findUnique({
            where: { id },
            include: { permissions: { include: { permission: true } } },
        });
        if (!role)
            (0, http_error_1.throwError)('NOT_FOUND');
        const cloned = await this.prisma.role.create({
            data: {
                name: name ?? `${role.name} (clone)`,
                description: description ?? role.description,
                isSystemRole: false,
                wildcard: role.wildcard,
                flagsJson: (role.flagsJson ?? undefined),
                constraintsTemplateJson: (role.constraintsTemplateJson ?? undefined),
                permissions: {
                    create: role.permissions.map((rp) => ({ permissionId: rp.permissionId })),
                },
            },
        });
        return cloned;
    }
    async listPermissions() {
        return this.prisma.permission.findMany({ orderBy: { resource: 'asc' } });
    }
    async setRolePermissions(roleId, permissions) {
        const role = await this.prisma.role.findUnique({ where: { id: roleId } });
        if (!role)
            (0, http_error_1.throwError)('NOT_FOUND');
        if (!permissions || permissions.length === 0) {
            await this.prisma.rolePermission.deleteMany({ where: { roleId } });
            return this.prisma.role.findUnique({ where: { id: roleId } });
        }
        const permissionRecords = await this.prisma.permission.findMany({
            where: {
                OR: permissions.map((perm) => ({
                    resource: perm.resource,
                    action: perm.action,
                    scope: perm.scope,
                })),
            },
        });
        if (permissionRecords.length !== permissions.length) {
            const invalidPermissions = permissions.filter((perm) => !permissionRecords.some((record) => record.resource === perm.resource &&
                record.action === perm.action &&
                record.scope === perm.scope));
            (0, http_error_1.throwError)('VALIDATION_ERROR', { invalidPermissions });
        }
        await this.prisma.rolePermission.deleteMany({ where: { roleId } });
        await this.prisma.rolePermission.createMany({
            data: permissionRecords.map((record) => ({ roleId, permissionId: record.id })),
        });
        return this.prisma.role.findUnique({ where: { id: roleId } });
    }
    async exportMatrix() {
        const roles = await this.prisma.role.findMany({
            include: {
                permissions: { include: { permission: true } },
            },
            orderBy: { name: 'asc' },
        });
        return {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            roles: roles.map((role) => ({
                name: role.name,
                description: role.description ?? undefined,
                isSystemRole: role.isSystemRole,
                wildcard: role.wildcard,
                flags: role.flagsJson ?? undefined,
                permissions: role.permissions.map((rp) => ({
                    resource: rp.permission.resource,
                    action: rp.permission.action,
                    scope: rp.permission.scope,
                })),
                constraintsTemplate: role.constraintsTemplateJson ?? undefined,
            })),
        };
    }
    async importMatrix(payload, mode = 'replace', userId) {
        if (!payload || !Array.isArray(payload.roles)) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'INVALID_PAYLOAD' });
        }
        const incomingRoles = payload.roles;
        const allPermissions = await this.prisma.permission.findMany();
        const invalidPermissions = [];
        for (const role of incomingRoles) {
            for (const perm of role.permissions ?? []) {
                const exists = allPermissions.some((p) => p.resource === perm.resource && p.action === perm.action && p.scope === perm.scope);
                if (!exists) {
                    invalidPermissions.push({ role: role.name, ...perm });
                }
            }
        }
        if (invalidPermissions.length > 0) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { invalidPermissions });
        }
        const backup = await this.exportMatrix();
        let updatedRoles = 0;
        let createdRoles = 0;
        for (const role of incomingRoles) {
            const existing = await this.prisma.role.findUnique({ where: { name: role.name } });
            const permissionIds = allPermissions
                .filter((p) => (role.permissions ?? []).some((perm) => perm.resource === p.resource && perm.action === p.action && perm.scope === p.scope))
                .map((p) => p.id);
            if (!existing) {
                const created = await this.prisma.role.create({
                    data: {
                        name: role.name,
                        description: role.description ?? null,
                        isSystemRole: role.isSystemRole ?? false,
                        wildcard: role.wildcard ?? false,
                        flagsJson: (role.flags ?? undefined),
                        constraintsTemplateJson: (role.constraintsTemplate ?? undefined),
                        permissions: {
                            create: permissionIds.map((id) => ({ permissionId: id })),
                        },
                    },
                });
                if (created)
                    createdRoles += 1;
            }
            else {
                await this.prisma.role.update({
                    where: { id: existing.id },
                    data: {
                        description: role.description ?? existing.description,
                        wildcard: role.wildcard ?? existing.wildcard,
                        flagsJson: (role.flags ?? existing.flagsJson ?? undefined),
                        constraintsTemplateJson: (role.constraintsTemplate ?? existing.constraintsTemplateJson ?? undefined),
                    },
                });
                if (mode === 'replace') {
                    await this.prisma.rolePermission.deleteMany({ where: { roleId: existing.id } });
                }
                const current = await this.prisma.rolePermission.findMany({ where: { roleId: existing.id } });
                const currentIds = new Set(current.map((rp) => rp.permissionId));
                const toAdd = permissionIds.filter((id) => !currentIds.has(id));
                if (toAdd.length > 0) {
                    await this.prisma.rolePermission.createMany({
                        data: toAdd.map((id) => ({ roleId: existing.id, permissionId: id })),
                    });
                }
                updatedRoles += 1;
            }
        }
        await this.audit.log({
            userId,
            resource: 'admin_rbac',
            action: 'import',
            diffJson: { mode, updatedRoles, createdRoles, backup },
        });
        return { updatedRoles, createdRoles, warnings: [] };
    }
    async simulateAccess(params) {
        if (params.userId) {
            const user = await this.prisma.user.findUnique({
                where: { id: params.userId },
                include: {
                    roles: {
                        include: {
                            role: {
                                include: { permissions: { include: { permission: true } } },
                            },
                        },
                    },
                },
            });
            if (!user)
                (0, http_error_1.throwError)('NOT_FOUND');
            const permissions = user.roles.flatMap((ur) => ur.role.permissions.map((rp) => ({
                resource: rp.permission.resource,
                action: rp.permission.action,
                scope: rp.permission.scope,
            })));
            return { source: 'user', id: user.id, permissions };
        }
        if (params.roleId) {
            const role = await this.prisma.role.findUnique({
                where: { id: params.roleId },
                include: { permissions: { include: { permission: true } } },
            });
            if (!role)
                (0, http_error_1.throwError)('NOT_FOUND');
            const permissions = role.permissions.map((rp) => ({
                resource: rp.permission.resource,
                action: rp.permission.action,
                scope: rp.permission.scope,
            }));
            return { source: 'role', id: role.id, permissions };
        }
        (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'MISSING_PARAMS' });
    }
};
exports.RbacService = RbacService;
exports.RbacService = RbacService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], RbacService);
//# sourceMappingURL=rbac.service.js.map