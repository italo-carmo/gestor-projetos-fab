import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { PermissionScope, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { throwError } from '../common/http-error';
import { AuditService } from '../audit/audit.service';
import { PermissionRequirement, RbacUser } from './rbac.types';
import { FabLdapService } from '../ldap/fab-ldap.service';
import { PERMISSION_METADATA_KEY } from './require-permission.decorator';
import {
  canonicalRoleName,
  ROLE_CIPAVD,
  ROLE_COMISSAO_CIPAVD,
  ROLE_CPCA,
  normalizeRoleName,
  ROLE_COMANDANTE_COMGEP,
  ROLE_COORDENACAO_CIPAVD,
  ROLE_TI,
} from './role-access';

type PermissionEntry = {
  resource: string;
  action: string;
  scope: PermissionScope;
};
type UserAccessPayload = Prisma.UserGetPayload<{
  include: {
    roles: {
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } };
          };
        };
      };
    };
    moduleAccessOverrides: true;
  };
}>;

const LOCALITY_REQUIRED_ROLE_NAMES = new Set([
  'admin especialidade local',
  'gsd localidade',
  'admin localidade',
  'administracao local',
  'cpca',
]);

const SPECIALTY_REQUIRED_ROLE_NAMES = new Set([
  'admin especialidade local',
  'admin especialidade nacional',
]);

const TI_ROLE_NAME_NORMALIZED = normalizeRoleName(ROLE_TI);
const TI_BLOCKED_PERMISSION_KEYS = new Set(['audit_logs:delete']);

function roleRequiresLocality(roleName: string | null | undefined) {
  return LOCALITY_REQUIRED_ROLE_NAMES.has(normalizeRoleName(roleName));
}

function roleRequiresSpecialty(roleName: string | null | undefined) {
  return SPECIALTY_REQUIRED_ROLE_NAMES.has(normalizeRoleName(roleName));
}

@Injectable()
export class RbacService implements OnModuleInit {
  private permissionCatalogSynced = false;
  private permissionCatalogSyncPromise: Promise<void> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly fabLdap: FabLdapService,
    private readonly discovery: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
  ) {}

  async onModuleInit() {
    await this.ensurePermissionCatalogSynced();
  }

  private async ensurePermissionCatalogSynced() {
    if (this.permissionCatalogSynced) return;
    if (this.permissionCatalogSyncPromise) {
      await this.permissionCatalogSyncPromise;
      return;
    }

    this.permissionCatalogSyncPromise = this.syncPermissionCatalogFromMetadata()
      .then(() => {
        this.permissionCatalogSynced = true;
      })
      .finally(() => {
        this.permissionCatalogSyncPromise = null;
      });

    await this.permissionCatalogSyncPromise;
  }

  async getUserAccess(
    userId: string,
    activeRoleId?: string | null,
  ): Promise<RbacUser> {
    await this.ensurePermissionCatalogSynced();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          orderBy: { role: { name: 'asc' } },
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
      throwError('RBAC_FORBIDDEN');
    }

    return this.buildAccessFromUser(user, activeRoleId);
  }

  async listRoles() {
    await this.ensurePermissionCatalogSynced();

    const roles = await this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: { permissions: { include: { permission: true } } },
    });
    return roles.map((role) => ({
      ...role,
      name: canonicalRoleName(role.name),
      wildcard: this.normalizeRoleWildcard(role.name, role.wildcard),
      permissions: role.permissions.map((entry) => ({
        resource: entry.permission.resource,
        action: entry.permission.action,
        scope: entry.permission.scope,
      })),
    }));
  }

  async createRole(data: Prisma.RoleCreateInput) {
    const normalizedData: Prisma.RoleCreateInput = {
      ...data,
      wildcard: this.normalizeRoleWildcard(
        data.name,
        typeof data.wildcard === 'boolean' ? data.wildcard : false,
      ),
    };
    return this.prisma.role.create({ data: normalizedData });
  }

  async updateRole(id: string, data: Prisma.RoleUpdateInput) {
    const existing = await this.prisma.role.findUnique({ where: { id } });
    if (!existing) throwError('NOT_FOUND');

    const nextName =
      typeof data.name === 'string' && data.name.trim().length > 0
        ? data.name
        : existing.name;
    const nextWildcard =
      typeof data.wildcard === 'boolean' ? data.wildcard : existing.wildcard;

    const normalizedData: Prisma.RoleUpdateInput = {
      ...data,
      wildcard: this.normalizeRoleWildcard(nextName, nextWildcard),
    };

    return this.prisma.role.update({ where: { id }, data: normalizedData });
  }

  async deleteRole(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throwError('NOT_FOUND');
    if (role.isSystemRole) {
      throwError('VALIDATION_ERROR', { reason: 'ROLE_IS_SYSTEM' });
    }
    await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
    await this.prisma.userRole.deleteMany({ where: { roleId: id } });
    await this.prisma.role.delete({ where: { id } });
  }

  async cloneRole(id: string, name?: string, description?: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throwError('NOT_FOUND');

    const cloned = await this.prisma.role.create({
      data: {
        name: name ?? `${role.name} (clone)`,
        description: description ?? role.description,
        isSystemRole: false,
        wildcard: this.normalizeRoleWildcard(
          name ?? `${role.name} (clone)`,
          role.wildcard,
        ),
        flagsJson: (role.flagsJson ?? undefined) as any,
        constraintsTemplateJson: (role.constraintsTemplateJson ??
          undefined) as any,
        permissions: {
          create: role.permissions.map((rp) => ({
            permissionId: rp.permissionId,
          })),
        },
      },
    });

    return cloned;
  }

  async listPermissions() {
    await this.ensurePermissionCatalogSynced();
    return this.prisma.permission.findMany({ orderBy: { resource: 'asc' } });
  }

  async setRolePermissions(
    roleId: string,
    permissions: { resource: string; action: string; scope: PermissionScope }[],
  ) {
    await this.ensurePermissionCatalogSynced();

    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throwError('NOT_FOUND');
    if (this.isTiRoleName(role.name)) {
      throwError('VALIDATION_ERROR', { reason: 'ROLE_TI_FIXED_PERMISSIONS' });
    }

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
      const invalidPermissions = permissions.filter(
        (perm) =>
          !permissionRecords.some(
            (record) =>
              record.resource === perm.resource &&
              record.action === perm.action &&
              record.scope === perm.scope,
          ),
      );
      throwError('VALIDATION_ERROR', { invalidPermissions });
    }

    await this.prisma.rolePermission.deleteMany({ where: { roleId } });
    await this.prisma.rolePermission.createMany({
      data: permissionRecords.map((record) => ({
        roleId,
        permissionId: record.id,
      })),
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
        name: canonicalRoleName(role.name),
        description: role.description ?? undefined,
        isSystemRole: role.isSystemRole,
        wildcard: this.normalizeRoleWildcard(role.name, role.wildcard),
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

  async importMatrix(
    payload: any,
    mode: 'replace' | 'merge' = 'replace',
    userId?: string,
  ) {
    await this.ensurePermissionCatalogSynced();

    if (!payload || !Array.isArray(payload.roles)) {
      throwError('VALIDATION_ERROR', { reason: 'INVALID_PAYLOAD' });
    }

    const incomingRoles = payload.roles as Array<{
      name: string;
      description?: string;
      isSystemRole?: boolean;
      wildcard?: boolean;
      flags?: Record<string, unknown>;
      permissions?: {
        resource: string;
        action: string;
        scope: PermissionScope;
      }[];
      constraintsTemplate?: Record<string, unknown>;
    }>;

    const allPermissions = await this.prisma.permission.findMany();

    const invalidPermissions: any[] = [];
    for (const role of incomingRoles) {
      for (const perm of role.permissions ?? []) {
        const exists = allPermissions.some(
          (p) =>
            p.resource === perm.resource &&
            p.action === perm.action &&
            p.scope === perm.scope,
        );
        if (!exists) {
          invalidPermissions.push({ role: role.name, ...perm });
        }
      }
    }

    if (invalidPermissions.length > 0) {
      throwError('VALIDATION_ERROR', { invalidPermissions });
    }

    const backup = await this.exportMatrix();
    let updatedRoles = 0;
    let createdRoles = 0;

    for (const role of incomingRoles) {
      const existing = await this.prisma.role.findUnique({
        where: { name: role.name },
      });
      const permissionIds = allPermissions
        .filter((p) =>
          (role.permissions ?? []).some(
            (perm) =>
              perm.resource === p.resource &&
              perm.action === p.action &&
              perm.scope === p.scope,
          ),
        )
        .map((p) => p.id);

      if (!existing) {
        const created = await this.prisma.role.create({
          data: {
            name: role.name,
            description: role.description ?? null,
            isSystemRole: role.isSystemRole ?? false,
            wildcard: this.normalizeRoleWildcard(
              role.name,
              role.wildcard ?? false,
            ),
            flagsJson: (role.flags ?? undefined) as any,
            constraintsTemplateJson: (role.constraintsTemplate ??
              undefined) as any,
            permissions: {
              create: permissionIds.map((id) => ({ permissionId: id })),
            },
          },
        });
        if (created) createdRoles += 1;
      } else {
        await this.prisma.role.update({
          where: { id: existing.id },
          data: {
            description: role.description ?? existing.description,
            wildcard: this.normalizeRoleWildcard(
              role.name,
              role.wildcard ?? existing.wildcard,
            ),
            flagsJson: (role.flags ?? existing.flagsJson ?? undefined) as any,
            constraintsTemplateJson: (role.constraintsTemplate ??
              existing.constraintsTemplateJson ??
              undefined) as any,
          },
        });

        if (mode === 'replace') {
          await this.prisma.rolePermission.deleteMany({
            where: { roleId: existing.id },
          });
        }

        const current = await this.prisma.rolePermission.findMany({
          where: { roleId: existing.id },
        });
        const currentIds = new Set(current.map((rp) => rp.permissionId));

        const toAdd = permissionIds.filter((id) => !currentIds.has(id));
        if (toAdd.length > 0) {
          await this.prisma.rolePermission.createMany({
            data: toAdd.map((id) => ({
              roleId: existing.id,
              permissionId: id,
            })),
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

  async getUserModuleAccess(userId: string) {
    await this.ensurePermissionCatalogSynced();

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

    if (!user) throwError('NOT_FOUND');

    const resources = await this.listPermissionResources();
    const hasTiRole = user.roles.some((ur) => this.isTiRoleName(ur.role.name));
    const roleResources = new Set(
      user.roles.flatMap((ur) =>
        ur.role.permissions.map((rp) => rp.permission.resource),
      ),
    );
    const overrideByResource = new Map(
      user.moduleAccessOverrides.map((item) => [item.resource, item.enabled]),
    );

    const modules = resources.map((resource) => {
      const baseEnabled = hasTiRole || roleResources.has(resource);
      const overrideEnabled = overrideByResource.has(resource)
        ? (overrideByResource.get(resource) as boolean)
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

  async setUserModuleAccess(
    userId: string,
    payload: { resource: string; enabled: boolean },
    actorUserId?: string,
  ) {
    await this.ensurePermissionCatalogSynced();

    const resource = String(payload.resource ?? '').trim();
    if (!resource) {
      throwError('VALIDATION_ERROR', { reason: 'RESOURCE_REQUIRED' });
    }

    const permissionExists = await this.prisma.permission.findFirst({
      where: { resource },
      select: { id: true },
    });
    if (!permissionExists) {
      throwError('VALIDATION_ERROR', { reason: 'INVALID_RESOURCE', resource });
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
    if (!user) throwError('NOT_FOUND');

    const hasTiRole = user.roles.some((ur) => this.isTiRoleName(ur.role.name));
    const roleResources = new Set(
      user.roles.flatMap((ur) =>
        ur.role.permissions.map((rp) => rp.permission.resource),
      ),
    );
    const baseEnabled = hasTiRole || roleResources.has(resource);

    if (payload.enabled === baseEnabled) {
      await this.prisma.userModuleAccessOverride.deleteMany({
        where: { userId, resource },
      });
    } else {
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

  async lookupLdapUser(identifier: string) {
    const normalizedIdentifier = this.normalizeLdapIdentifier(identifier);
    if (!normalizedIdentifier) {
      throwError('VALIDATION_ERROR', { reason: 'LDAP_UID_REQUIRED' });
    }

    const profile = await this.lookupLdapByIdentifier(normalizedIdentifier);
    if (!profile) {
      throwError('NOT_FOUND');
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

  async upsertLdapUser(
    payload: {
      uid: string;
      roleId?: string;
      roleIds?: string[];
      localityId?: string | null;
      specialtyId?: string | null;
      eloRoleId?: string | null;
      replaceExistingRoles?: boolean;
    },
    actorUserId?: string,
  ) {
    const identifier = this.normalizeLdapIdentifier(payload.uid);
    if (!identifier) {
      throwError('VALIDATION_ERROR', { reason: 'LDAP_UID_REQUIRED' });
    }

    const selectedRoleIds = Array.from(
      new Set(
        [
          payload.roleId,
          ...(Array.isArray(payload.roleIds) ? payload.roleIds : []),
        ]
          .map((value) => String(value ?? '').trim())
          .filter(Boolean),
      ),
    );
    if (!selectedRoleIds.length) {
      throwError('VALIDATION_ERROR', { reason: 'ROLE_REQUIRED' });
    }

    const roles = await this.prisma.role.findMany({
      where: { id: { in: selectedRoleIds } },
      select: { id: true, name: true },
    });
    if (roles.length !== selectedRoleIds.length) {
      throwError('NOT_FOUND');
    }
    const profile = await this.lookupLdapByIdentifier(identifier);
    if (!profile) {
      throwError('VALIDATION_ERROR', {
        reason: 'LDAP_USER_NOT_FOUND',
        uid: identifier,
      });
    }
    const uid = profile.uid;

    const preferredEmail =
      this.normalizeEmail(profile.email) ?? `${uid}@fab.intraer`;
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

    const targetLocalityId =
      payload.localityId !== undefined
        ? payload.localityId
        : (existing?.localityId ?? null);
    if (
      roles.some((role) => roleRequiresLocality(role.name)) &&
      !targetLocalityId
    ) {
      throwError('USER_LOCAL_ROLE_REQUIRES_LOCALITY');
    }
    const targetSpecialtyId =
      payload.specialtyId !== undefined
        ? payload.specialtyId
        : (existing?.specialtyId ?? null);
    const targetEloRoleId =
      payload.eloRoleId !== undefined
        ? payload.eloRoleId
        : (existing?.eloRoleId ?? null);
    if (
      roles.some((role) => roleRequiresSpecialty(role.name)) &&
      !targetSpecialtyId &&
      !targetEloRoleId
    ) {
      throwError('USER_SPECIALTY_ROLE_REQUIRES_SPECIALTY');
    }

    const uniqueEmail = await this.resolveUniqueEmail(
      preferredEmail,
      uid,
      existing?.id,
    );
    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            ldapUid: uid,
            name: preferredName,
            email: uniqueEmail,
            isActive: true,
            localityId:
              payload.localityId !== undefined ? payload.localityId : undefined,
            specialtyId:
              payload.specialtyId !== undefined
                ? payload.specialtyId
                : undefined,
            eloRoleId:
              payload.eloRoleId !== undefined ? payload.eloRoleId : undefined,
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

    const replaceExistingRoles = Boolean(payload.replaceExistingRoles);
    if (replaceExistingRoles) {
      await this.prisma.userRole.deleteMany({
        where: { userId: user.id },
      });
    }

    await this.prisma.userRole.createMany({
      data: selectedRoleIds.map((roleId) => ({ userId: user.id, roleId })),
      skipDuplicates: true,
    });

    const userWithRoles = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        roles: {
          orderBy: { role: { name: 'asc' } },
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
        roleIds: roles.map((item) => item.id),
        roleNames: roles.map((item) => item.name),
        replaceExistingRoles,
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
              name: canonicalRoleName(item.role.name),
            })),
          }
        : null,
    };
  }

  async simulateAccess(params: { userId?: string; roleId?: string }) {
    await this.ensurePermissionCatalogSynced();

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
      if (!user) throwError('NOT_FOUND');
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
      if (!role) throwError('NOT_FOUND');
      const isTiRole = this.isTiRoleName(role.name);
      const basePermissions = role.permissions.map((rp) => ({
        resource: rp.permission.resource,
        action: rp.permission.action,
        scope: rp.permission.scope,
      }));
      const tiCatalogPermissions = isTiRole
        ? await this.listPermissionEntries()
        : [];
      const mergedPermissions = this.dedupePermissions([
        ...basePermissions,
        ...tiCatalogPermissions,
      ]);
      const permissions = isTiRole
        ? this.filterTiPermissions(mergedPermissions)
        : mergedPermissions;
      return {
        source: 'role',
        id: role.id,
        wildcard: this.normalizeRoleWildcard(role.name, role.wildcard),
        permissions,
      };
    }

    throwError('VALIDATION_ERROR', { reason: 'MISSING_PARAMS' });
  }

  private async buildAccessFromUser(
    user: UserAccessPayload,
    requestedActiveRoleId?: string | null,
  ): Promise<RbacUser> {
    const allRoles = user.roles
      .map((userRole) => ({
        id: userRole.role.id,
        name: canonicalRoleName(userRole.role.name),
        wildcard: this.normalizeRoleWildcard(
          userRole.role.name,
          userRole.role.wildcard,
        ),
        constraintsTemplateJson: userRole.role
          .constraintsTemplateJson as Record<string, unknown> | null,
        flagsJson: userRole.role.flagsJson as Record<string, unknown> | null,
        permissions: userRole.role.permissions.map((rp) => ({
          resource: rp.permission.resource,
          action: rp.permission.action,
          scope: rp.permission.scope,
        })),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const requestedRoleId = String(requestedActiveRoleId ?? '').trim();
    const requestedRole = requestedRoleId
      ? allRoles.find((role) => role.id === requestedRoleId)
      : undefined;
    const activeRole = requestedRole ?? this.pickDefaultActiveRole(allRoles);
    const roles = activeRole ? [activeRole] : [];

    const normalizedRoles = new Set(
      roles.map((role) => normalizeRoleName(role.name)),
    );
    const hasNationalScope =
      normalizedRoles.has(normalizeRoleName(ROLE_TI)) ||
      normalizedRoles.has(normalizeRoleName(ROLE_COORDENACAO_CIPAVD)) ||
      normalizedRoles.has(normalizeRoleName(ROLE_COMISSAO_CIPAVD)) ||
      normalizedRoles.has(normalizeRoleName(ROLE_COMANDANTE_COMGEP));
    const moduleAccessOverrides = user.moduleAccessOverrides.map((item) => ({
      resource: item.resource,
      enabled: item.enabled,
    }));

    const isTiActiveRole = roles.some((role) => this.isTiRoleName(role.name));
    const enabledOverrideResources = isTiActiveRole
      ? []
      : moduleAccessOverrides
          .filter((item) => item.enabled)
          .map((item) => item.resource);
    const needsCatalogPermissions =
      isTiActiveRole || enabledOverrideResources.length > 0;
    const catalogPermissions = needsCatalogPermissions
      ? await this.listPermissionEntries(
          isTiActiveRole
            ? undefined
            : { resource: { in: enabledOverrideResources } },
        )
      : [];

    const rolePermissions = this.dedupePermissions(
      roles.flatMap((role) => role.permissions),
    );
    const basePermissions = isTiActiveRole
      ? this.dedupePermissions([...rolePermissions, ...catalogPermissions])
      : rolePermissions;
    const permissionsWithOverrides = isTiActiveRole
      ? basePermissions
      : this.applyModuleAccessOverrides(
          basePermissions,
          moduleAccessOverrides,
          catalogPermissions,
        );
    const permissions = isTiActiveRole
      ? this.filterTiPermissions(permissionsWithOverrides)
      : permissionsWithOverrides;

    const executiveFromRole = roles.some(
      (role) =>
        role.flagsJson &&
        (role.flagsJson as { executive_hide_pii?: boolean })
          .executive_hide_pii === true,
    );

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
      allRoles,
      activeRoleId: activeRole?.id ?? null,
    };
  }

  private async listPermissionEntries(where?: Prisma.PermissionWhereInput) {
    await this.ensurePermissionCatalogSynced();

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

  private async listPermissionResources() {
    await this.ensurePermissionCatalogSynced();

    const items = await this.prisma.permission.findMany({
      select: { resource: true },
      distinct: ['resource'],
      orderBy: { resource: 'asc' },
    });
    return items.map((item) => item.resource);
  }

  private async syncPermissionCatalogFromMetadata() {
    const declared = this.collectDeclaredPermissionRequirements();
    if (declared.length === 0) return;

    const resources = Array.from(
      new Set(declared.map((item) => item.resource)),
    );
    const existing = await this.prisma.permission.findMany({
      where: { resource: { in: resources } },
      select: { resource: true, action: true, scope: true },
    });

    const existingKeys = new Set(
      existing.map((item) => `${item.resource}:${item.action}:${item.scope}`),
    );
    const actionKeys = new Set(
      existing.map((item) => `${item.resource}:${item.action}`),
    );
    const scopesByResource = new Map<string, Set<PermissionScope>>();
    for (const item of existing) {
      if (!scopesByResource.has(item.resource)) {
        scopesByResource.set(item.resource, new Set<PermissionScope>());
      }
      scopesByResource.get(item.resource)?.add(item.scope);
    }

    const toCreate: Array<{
      resource: string;
      action: string;
      scope: PermissionScope;
    }> = [];
    const queueCreate = (
      resource: string,
      action: string,
      scope: PermissionScope,
    ) => {
      const key = `${resource}:${action}:${scope}`;
      if (existingKeys.has(key)) return;
      existingKeys.add(key);
      actionKeys.add(`${resource}:${action}`);
      if (!scopesByResource.has(resource)) {
        scopesByResource.set(resource, new Set<PermissionScope>());
      }
      scopesByResource.get(resource)?.add(scope);
      toCreate.push({ resource, action, scope });
    };

    for (const item of declared) {
      if (item.scope) {
        queueCreate(item.resource, item.action, item.scope);
        continue;
      }

      const actionKey = `${item.resource}:${item.action}`;
      if (actionKeys.has(actionKey)) continue;

      const resourceScopes = scopesByResource.get(item.resource);
      const scopesToCreate =
        resourceScopes && resourceScopes.size > 0
          ? Array.from(resourceScopes.values())
          : [PermissionScope.LOCALITY];
      for (const scope of scopesToCreate) {
        queueCreate(item.resource, item.action, scope);
      }
    }

    if (toCreate.length === 0) return;

    await this.prisma.permission.createMany({
      data: toCreate,
      skipDuplicates: true,
    });
  }

  private collectDeclaredPermissionRequirements() {
    const requirements = new Map<
      string,
      { resource: string; action: string; scope?: PermissionScope }
    >();

    for (const wrapper of this.discovery.getControllers()) {
      const instance = wrapper.instance;
      if (!instance) continue;
      const prototype = Object.getPrototypeOf(instance);
      if (!prototype) continue;

      const methodNames = this.metadataScanner.getAllMethodNames(prototype);
      for (const methodName of methodNames) {
        const handler = prototype[methodName];
        if (typeof handler !== 'function') continue;

        const requirement = Reflect.getMetadata(
          PERMISSION_METADATA_KEY,
          handler,
        ) as PermissionRequirement | undefined;
        if (!requirement) continue;

        const resource = String(requirement.resource ?? '').trim();
        const action = String(requirement.action ?? '').trim();
        if (!resource || !action) continue;

        const scope = this.normalizePermissionScope(requirement.scope);
        const key = `${resource}:${action}:${scope ?? '*'}`;
        if (!requirements.has(key)) {
          requirements.set(key, { resource, action, scope });
        }
      }
    }

    return Array.from(requirements.values());
  }

  private normalizePermissionScope(scope: PermissionRequirement['scope']) {
    const normalized = String(scope ?? '')
      .trim()
      .toUpperCase();
    if (!normalized) return undefined;

    return (Object.values(PermissionScope) as string[]).includes(normalized)
      ? (normalized as PermissionScope)
      : undefined;
  }

  private isTiRoleName(roleName: string | null | undefined) {
    return normalizeRoleName(roleName) === TI_ROLE_NAME_NORMALIZED;
  }

  private normalizeRoleWildcard(
    roleName: string | null | undefined,
    wildcard: boolean | null | undefined,
  ) {
    if (this.isTiRoleName(roleName)) {
      return Boolean(wildcard);
    }
    return false;
  }

  private filterTiPermissions(items: PermissionEntry[]) {
    return items.filter(
      (item) =>
        !TI_BLOCKED_PERMISSION_KEYS.has(`${item.resource}:${item.action}`),
    );
  }

  private dedupePermissions(items: PermissionEntry[]) {
    const map = new Map<string, PermissionEntry>();
    for (const item of items) {
      const key = `${item.resource}:${item.action}:${item.scope}`;
      if (!map.has(key)) {
        map.set(key, item);
      }
    }
    return Array.from(map.values());
  }

  private pickDefaultActiveRole(roles: Array<RbacUser['roles'][number]>) {
    if (!roles.length) return null;

    const priorityOrder = new Map<string, number>([
      [normalizeRoleName(ROLE_TI), 0],
      [normalizeRoleName(ROLE_COMISSAO_CIPAVD), 1],
      [normalizeRoleName(ROLE_CIPAVD), 2],
      [normalizeRoleName(ROLE_COORDENACAO_CIPAVD), 3],
      [normalizeRoleName(ROLE_COMANDANTE_COMGEP), 4],
      [normalizeRoleName(ROLE_CPCA), 5],
    ]);

    const sorted = [...roles].sort((a, b) => {
      const priorityA =
        priorityOrder.get(normalizeRoleName(a.name)) ?? Number.MAX_SAFE_INTEGER;
      const priorityB =
        priorityOrder.get(normalizeRoleName(b.name)) ?? Number.MAX_SAFE_INTEGER;
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      if (a.wildcard !== b.wildcard) {
        return a.wildcard ? -1 : 1;
      }

      const permissionCountA = this.dedupePermissions(a.permissions).length;
      const permissionCountB = this.dedupePermissions(b.permissions).length;
      if (permissionCountA !== permissionCountB) {
        return permissionCountB - permissionCountA;
      }

      return a.name.localeCompare(b.name, 'pt-BR');
    });

    return sorted[0] ?? null;
  }

  private applyModuleAccessOverrides(
    basePermissions: PermissionEntry[],
    overrides: Array<{ resource: string; enabled: boolean }>,
    catalogPermissions: PermissionEntry[],
  ) {
    const disabledResources = new Set(
      overrides.filter((item) => !item.enabled).map((item) => item.resource),
    );
    const enabledResources = new Set(
      overrides.filter((item) => item.enabled).map((item) => item.resource),
    );

    const filtered = basePermissions.filter(
      (item) => !disabledResources.has(item.resource),
    );
    const extra = catalogPermissions.filter((item) =>
      enabledResources.has(item.resource),
    );

    return this.dedupePermissions([...filtered, ...extra]);
  }

  private normalizeEmail(email: string | null | undefined) {
    const value = String(email ?? '')
      .trim()
      .toLowerCase();
    return value || null;
  }

  private normalizeLdapIdentifier(identifier: string | null | undefined) {
    return String(identifier ?? '').trim();
  }

  private normalizeUidForLookup(identifier: string) {
    const onlyDigits = identifier.replace(/\D/g, '');
    return onlyDigits || identifier;
  }

  private async lookupLdapByIdentifier(identifier: string) {
    if (identifier.includes('@')) {
      return this.fabLdap.lookupByEmail(identifier);
    }
    const onlyDigits = identifier.replace(/\D/g, '');
    if (onlyDigits.length === 11) {
      const byCpf = await this.fabLdap.lookupByCpf(onlyDigits);
      if (byCpf) return byCpf;
    }
    return this.fabLdap.lookupByUid(this.normalizeUidForLookup(identifier));
  }

  private async resolveUniqueEmail(
    preferredEmail: string,
    uid: string,
    excludeUserId?: string,
  ) {
    const base = this.normalizeEmail(preferredEmail) ?? `${uid}@fab.intraer`;
    const alreadyExists = async (email: string) => {
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

    throwError('CONFLICT_UNIQUE', { field: 'email', uid });
  }

  private async createTemporaryPasswordHash(uid: string) {
    const raw = `ldap:${uid}:${Date.now()}:${randomBytes(12).toString('hex')}`;
    return bcrypt.hash(raw, 10);
  }
}
