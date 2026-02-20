"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RbacService = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = __importStar(require("bcrypt"));
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const http_error_1 = require("../common/http-error");
const audit_service_1 = require("../audit/audit.service");
const fab_ldap_service_1 = require("../ldap/fab-ldap.service");
const role_access_1 = require("./role-access");
const LOCALITY_REQUIRED_ROLE_NAMES = new Set([
    'admin especialidade local',
    'gsd localidade',
    'admin localidade',
    'administracao local',
]);
const SPECIALTY_REQUIRED_ROLE_NAMES = new Set([
    'admin especialidade local',
    'admin especialidade nacional',
]);
function roleRequiresLocality(roleName) {
    return LOCALITY_REQUIRED_ROLE_NAMES.has((0, role_access_1.normalizeRoleName)(roleName));
}
function roleRequiresSpecialty(roleName) {
    return SPECIALTY_REQUIRED_ROLE_NAMES.has((0, role_access_1.normalizeRoleName)(roleName));
}
let RbacService = class RbacService {
    prisma;
    audit;
    fabLdap;
    constructor(prisma, audit, fabLdap) {
        this.prisma = prisma;
        this.audit = audit;
        this.fabLdap = fabLdap;
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
                moduleAccessOverrides: true,
            },
        });
        if (!user) {
            (0, http_error_1.throwError)('RBAC_FORBIDDEN');
        }
        return this.buildAccessFromUser(user);
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
    async getUserModuleAccess(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                roles: {
                    include: {
                        role: {
                            include: { permissions: { include: { permission: true } } },
                        },
                    },
                },
                moduleAccessOverrides: true,
            },
        });
        if (!user)
            (0, http_error_1.throwError)('NOT_FOUND');
        const resources = await this.listPermissionResources();
        const wildcard = user.roles.some((ur) => ur.role.wildcard);
        const roleResources = new Set(user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.resource)));
        const overrideByResource = new Map(user.moduleAccessOverrides.map((item) => [item.resource, item.enabled]));
        const modules = resources.map((resource) => {
            const baseEnabled = wildcard || roleResources.has(resource);
            const overrideEnabled = overrideByResource.has(resource)
                ? overrideByResource.get(resource)
                : null;
            const enabled = overrideEnabled ?? baseEnabled;
            const isOverridden = overrideEnabled !== null;
            return {
                resource,
                baseEnabled,
                enabled,
                isOverridden,
                source: isOverridden ? 'override' : baseEnabled ? 'role' : 'none',
            };
        });
        return {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            },
            modules,
            summary: {
                total: modules.length,
                enabled: modules.filter((item) => item.enabled).length,
                overridden: modules.filter((item) => item.isOverridden).length,
            },
        };
    }
    async setUserModuleAccess(userId, payload, actorUserId) {
        const resource = String(payload.resource ?? '').trim();
        if (!resource) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'RESOURCE_REQUIRED' });
        }
        const permissionExists = await this.prisma.permission.findFirst({
            where: { resource },
            select: { id: true },
        });
        if (!permissionExists) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'INVALID_RESOURCE', resource });
        }
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
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
        const wildcard = user.roles.some((ur) => ur.role.wildcard);
        const roleResources = new Set(user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.resource)));
        const baseEnabled = wildcard || roleResources.has(resource);
        if (payload.enabled === baseEnabled) {
            await this.prisma.userModuleAccessOverride.deleteMany({
                where: { userId, resource },
            });
        }
        else {
            await this.prisma.userModuleAccessOverride.upsert({
                where: { userId_resource: { userId, resource } },
                update: { enabled: payload.enabled },
                create: { userId, resource, enabled: payload.enabled },
            });
        }
        await this.audit.log({
            userId: actorUserId,
            resource: 'admin_rbac',
            action: 'set_user_module_access',
            entityId: userId,
            diffJson: { resource, enabled: payload.enabled, baseEnabled },
        });
        return this.getUserModuleAccess(userId);
    }
    async lookupLdapUser(uid) {
        const normalizedUid = String(uid ?? '').trim();
        if (!normalizedUid) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'LDAP_UID_REQUIRED' });
        }
        const profile = await this.fabLdap.lookupByUid(normalizedUid);
        if (!profile) {
            (0, http_error_1.throwError)('NOT_FOUND');
        }
        return {
            user: {
                uid: profile.uid,
                dn: profile.dn,
                name: profile.name,
                email: profile.email,
                fabom: profile.fabom,
            },
        };
    }
    async upsertLdapUser(payload, actorUserId) {
        const uid = String(payload.uid ?? '').trim();
        if (!uid) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'LDAP_UID_REQUIRED' });
        }
        const role = await this.prisma.role.findUnique({ where: { id: payload.roleId } });
        if (!role) {
            (0, http_error_1.throwError)('NOT_FOUND');
        }
        const profile = await this.fabLdap.lookupByUid(uid);
        if (!profile) {
            (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'LDAP_USER_NOT_FOUND', uid });
        }
        const preferredEmail = this.normalizeEmail(profile.email) ?? `${uid}@fab.intraer`;
        const preferredName = profile.name?.trim() || `Militar ${uid}`;
        const existing = await this.prisma.user.findFirst({
            where: {
                OR: [{ ldapUid: uid }, { email: preferredEmail }],
            },
            select: {
                id: true,
                email: true,
                name: true,
                localityId: true,
                specialtyId: true,
                eloRoleId: true,
            },
        });
        const targetLocalityId = payload.localityId !== undefined ? payload.localityId : (existing?.localityId ?? null);
        if (roleRequiresLocality(role.name) && !targetLocalityId) {
            (0, http_error_1.throwError)('USER_LOCAL_ROLE_REQUIRES_LOCALITY');
        }
        const targetSpecialtyId = payload.specialtyId !== undefined ? payload.specialtyId : (existing?.specialtyId ?? null);
        const targetEloRoleId = payload.eloRoleId !== undefined ? payload.eloRoleId : (existing?.eloRoleId ?? null);
        if (roleRequiresSpecialty(role.name) && !targetSpecialtyId && !targetEloRoleId) {
            (0, http_error_1.throwError)('USER_SPECIALTY_ROLE_REQUIRES_SPECIALTY');
        }
        const uniqueEmail = await this.resolveUniqueEmail(preferredEmail, uid, existing?.id);
        const user = existing
            ? await this.prisma.user.update({
                where: { id: existing.id },
                data: {
                    ldapUid: uid,
                    name: preferredName,
                    email: uniqueEmail,
                    isActive: true,
                    localityId: payload.localityId !== undefined ? payload.localityId : undefined,
                    specialtyId: payload.specialtyId !== undefined ? payload.specialtyId : undefined,
                    eloRoleId: payload.eloRoleId !== undefined ? payload.eloRoleId : undefined,
                },
            })
            : await this.prisma.user.create({
                data: {
                    ldapUid: uid,
                    name: preferredName,
                    email: uniqueEmail,
                    passwordHash: await this.createTemporaryPasswordHash(uid),
                    isActive: true,
                    localityId: payload.localityId ?? null,
                    specialtyId: payload.specialtyId ?? null,
                    eloRoleId: payload.eloRoleId ?? null,
                },
            });
        await this.prisma.userRole.deleteMany({
            where: { userId: user.id },
        });
        await this.prisma.userRole.create({
            data: { userId: user.id, roleId: role.id },
        });
        const userWithRoles = await this.prisma.user.findUnique({
            where: { id: user.id },
            include: {
                roles: {
                    include: {
                        role: {
                            select: { id: true, name: true },
                        },
                    },
                },
            },
        });
        await this.audit.log({
            userId: actorUserId,
            resource: 'admin_rbac',
            action: 'upsert_ldap_user',
            entityId: user.id,
            diffJson: {
                uid,
                roleId: role.id,
                roleName: role.name,
                replaceExistingRoles: true,
                localityId: payload.localityId ?? null,
                specialtyId: payload.specialtyId ?? null,
                eloRoleId: payload.eloRoleId ?? null,
            },
        });
        return {
            user: userWithRoles
                ? {
                    id: userWithRoles.id,
                    name: userWithRoles.name,
                    email: userWithRoles.email,
                    ldapUid: userWithRoles.ldapUid,
                    localityId: userWithRoles.localityId,
                    specialtyId: userWithRoles.specialtyId,
                    eloRoleId: userWithRoles.eloRoleId,
                    roles: userWithRoles.roles.map((item) => ({
                        id: item.role.id,
                        name: item.role.name,
                    })),
                }
                : null,
        };
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
                    moduleAccessOverrides: true,
                },
            });
            if (!user)
                (0, http_error_1.throwError)('NOT_FOUND');
            const access = await this.buildAccessFromUser(user);
            return {
                source: 'user',
                id: user.id,
                permissions: access.permissions,
                moduleAccessOverrides: access.moduleAccessOverrides,
            };
        }
        if (params.roleId) {
            const role = await this.prisma.role.findUnique({
                where: { id: params.roleId },
                include: { permissions: { include: { permission: true } } },
            });
            if (!role)
                (0, http_error_1.throwError)('NOT_FOUND');
            const basePermissions = role.permissions.map((rp) => ({
                resource: rp.permission.resource,
                action: rp.permission.action,
                scope: rp.permission.scope,
            }));
            const wildcardPermissions = role.wildcard
                ? await this.listPermissionEntries()
                : [];
            const permissions = this.dedupePermissions([
                ...basePermissions,
                ...wildcardPermissions,
            ]);
            return {
                source: 'role',
                id: role.id,
                wildcard: role.wildcard,
                permissions,
            };
        }
        (0, http_error_1.throwError)('VALIDATION_ERROR', { reason: 'MISSING_PARAMS' });
    }
    async buildAccessFromUser(user) {
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
        const normalizedRoles = new Set(roles.map((role) => (0, role_access_1.normalizeRoleName)(role.name)));
        const hasNationalScope = normalizedRoles.has((0, role_access_1.normalizeRoleName)(role_access_1.ROLE_TI)) ||
            normalizedRoles.has((0, role_access_1.normalizeRoleName)(role_access_1.ROLE_COORDENACAO_CIPAVD)) ||
            normalizedRoles.has((0, role_access_1.normalizeRoleName)(role_access_1.ROLE_COMANDANTE_COMGEP));
        const moduleAccessOverrides = user.moduleAccessOverrides.map((item) => ({
            resource: item.resource,
            enabled: item.enabled,
        }));
        const roleWildcard = roles.some((role) => role.wildcard);
        const enabledOverrideResources = moduleAccessOverrides
            .filter((item) => item.enabled)
            .map((item) => item.resource);
        const needsCatalogPermissions = roleWildcard || enabledOverrideResources.length > 0;
        const catalogPermissions = needsCatalogPermissions
            ? await this.listPermissionEntries(roleWildcard ? undefined : { resource: { in: enabledOverrideResources } })
            : [];
        const rolePermissions = this.dedupePermissions(roles.flatMap((role) => role.permissions));
        const basePermissions = roleWildcard
            ? this.dedupePermissions([...rolePermissions, ...catalogPermissions])
            : rolePermissions;
        const permissions = this.applyModuleAccessOverrides(basePermissions, moduleAccessOverrides, catalogPermissions);
        const executiveFromRole = roles.some((role) => role.flagsJson && role.flagsJson.executive_hide_pii === true);
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            localityId: hasNationalScope ? null : user.localityId,
            specialtyId: user.specialtyId,
            eloRoleId: user.eloRoleId,
            executiveHidePii: user.executiveHidePii || executiveFromRole,
            permissions,
            moduleAccessOverrides,
            roles,
        };
    }
    async listPermissionEntries(where) {
        const items = await this.prisma.permission.findMany({
            where,
            select: { resource: true, action: true, scope: true },
        });
        return items.map((item) => ({
            resource: item.resource,
            action: item.action,
            scope: item.scope,
        }));
    }
    async listPermissionResources() {
        const items = await this.prisma.permission.findMany({
            select: { resource: true },
            distinct: ['resource'],
            orderBy: { resource: 'asc' },
        });
        return items.map((item) => item.resource);
    }
    dedupePermissions(items) {
        const map = new Map();
        for (const item of items) {
            const key = `${item.resource}:${item.action}:${item.scope}`;
            if (!map.has(key)) {
                map.set(key, item);
            }
        }
        return Array.from(map.values());
    }
    applyModuleAccessOverrides(basePermissions, overrides, catalogPermissions) {
        const disabledResources = new Set(overrides.filter((item) => !item.enabled).map((item) => item.resource));
        const enabledResources = new Set(overrides.filter((item) => item.enabled).map((item) => item.resource));
        const filtered = basePermissions.filter((item) => !disabledResources.has(item.resource));
        const extra = catalogPermissions.filter((item) => enabledResources.has(item.resource));
        return this.dedupePermissions([...filtered, ...extra]);
    }
    normalizeEmail(email) {
        const value = String(email ?? '').trim().toLowerCase();
        return value || null;
    }
    async resolveUniqueEmail(preferredEmail, uid, excludeUserId) {
        const base = this.normalizeEmail(preferredEmail) ?? `${uid}@fab.intraer`;
        const alreadyExists = async (email) => {
            const existing = await this.prisma.user.findFirst({
                where: {
                    email,
                    ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
                },
                select: { id: true },
            });
            return Boolean(existing);
        };
        if (!(await alreadyExists(base))) {
            return base;
        }
        const fallbackBase = `${uid}@fab.intraer`;
        if (!(await alreadyExists(fallbackBase))) {
            return fallbackBase;
        }
        let attempt = 1;
        while (attempt <= 1000) {
            const candidate = `${uid}+${attempt}@fab.intraer`;
            if (!(await alreadyExists(candidate))) {
                return candidate;
            }
            attempt += 1;
        }
        (0, http_error_1.throwError)('CONFLICT_UNIQUE', { field: 'email', uid });
    }
    async createTemporaryPasswordHash(uid) {
        const raw = `ldap:${uid}:${Date.now()}:${(0, crypto_1.randomBytes)(12).toString('hex')}`;
        return bcrypt.hash(raw, 10);
    }
};
exports.RbacService = RbacService;
exports.RbacService = RbacService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        fab_ldap_service_1.FabLdapService])
], RbacService);
//# sourceMappingURL=rbac.service.js.map