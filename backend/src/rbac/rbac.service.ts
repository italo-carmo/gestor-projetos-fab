import { Injectable } from '@nestjs/common';
import { PermissionScope, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { throwError } from '../common/http-error';
import { AuditService } from '../audit/audit.service';
import { RbacUser } from './rbac.types';
import { FabLdapService } from '../ldap/fab-ldap.service';
import {
  normalizeRoleName,
  ROLE_COMANDANTE_COMGEP,
  ROLE_COORDENACAO_CIPAVD,
  ROLE_TI,
} from './role-access';

type PermissionEntry = { resource: string; action: string; scope: PermissionScope };
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

@Injectable()
export class RbacService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly fabLdap: FabLdapService,
  ) {}

  async getUserAccess(userId: string): Promise<RbacUser> {
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
      throwError('RBAC_FORBIDDEN');
    }

    return this.buildAccessFromUser(user);
  }

  async listRoles() {
    return this.prisma.role.findMany({ orderBy: { name: 'asc' } });
  }

  async createRole(data: Prisma.RoleCreateInput) {
    return this.prisma.role.create({ data });
  }

  async updateRole(id: string, data: Prisma.RoleUpdateInput) {
    return this.prisma.role.update({ where: { id }, data });
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
        wildcard: role.wildcard,
        flagsJson: (role.flagsJson ?? undefined) as any,
        constraintsTemplateJson: (role.constraintsTemplateJson ?? undefined) as any,
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

  async setRolePermissions(roleId: string, permissions: { resource: string; action: string; scope: PermissionScope }[]) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throwError('NOT_FOUND');

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

  async importMatrix(payload: any, mode: 'replace' | 'merge' = 'replace', userId?: string) {
    if (!payload || !Array.isArray(payload.roles)) {
      throwError('VALIDATION_ERROR', { reason: 'INVALID_PAYLOAD' });
    }

    const incomingRoles = payload.roles as Array<{
      name: string;
      description?: string;
      isSystemRole?: boolean;
      wildcard?: boolean;
      flags?: Record<string, unknown>;
      permissions?: { resource: string; action: string; scope: PermissionScope }[];
      constraintsTemplate?: Record<string, unknown>;
    }>;

    const allPermissions = await this.prisma.permission.findMany();

    const invalidPermissions: any[] = [];
    for (const role of incomingRoles) {
      for (const perm of role.permissions ?? []) {
        const exists = allPermissions.some(
          (p) => p.resource === perm.resource && p.action === perm.action && p.scope === perm.scope,
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
      const existing = await this.prisma.role.findUnique({ where: { name: role.name } });
      const permissionIds = allPermissions
        .filter((p) =>
          (role.permissions ?? []).some(
            (perm) =>
              perm.resource === p.resource && perm.action === p.action && perm.scope === p.scope,
          ),
        )
        .map((p) => p.id);

      if (!existing) {
        const created = await this.prisma.role.create({
          data: {
            name: role.name,
            description: role.description ?? null,
            isSystemRole: role.isSystemRole ?? false,
            wildcard: role.wildcard ?? false,
            flagsJson: (role.flags ?? undefined) as any,
            constraintsTemplateJson: (role.constraintsTemplate ?? undefined) as any,
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
            wildcard: role.wildcard ?? existing.wildcard,
            flagsJson: (role.flags ?? existing.flagsJson ?? undefined) as any,
            constraintsTemplateJson: (role.constraintsTemplate ?? existing.constraintsTemplateJson ?? undefined) as any,
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

  async getUserModuleAccess(userId: string) {
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
    const wildcard = user.roles.some((ur) => ur.role.wildcard);
    const roleResources = new Set(
      user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.resource)),
    );
    const overrideByResource = new Map(
      user.moduleAccessOverrides.map((item) => [item.resource, item.enabled]),
    );

    const modules = resources.map((resource) => {
      const baseEnabled = wildcard || roleResources.has(resource);
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

    const wildcard = user.roles.some((ur) => ur.role.wildcard);
    const roleResources = new Set(
      user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.resource)),
    );
    const baseEnabled = wildcard || roleResources.has(resource);

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

  async lookupLdapUser(uid: string) {
    const normalizedUid = String(uid ?? '').trim();
    if (!normalizedUid) {
      throwError('VALIDATION_ERROR', { reason: 'LDAP_UID_REQUIRED' });
    }

    const profile = await this.fabLdap.lookupByUid(normalizedUid);
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
      roleId: string;
      localityId?: string | null;
      specialtyId?: string | null;
      eloRoleId?: string | null;
      replaceExistingRoles?: boolean;
    },
    actorUserId?: string,
  ) {
    const uid = String(payload.uid ?? '').trim();
    if (!uid) {
      throwError('VALIDATION_ERROR', { reason: 'LDAP_UID_REQUIRED' });
    }

    const role = await this.prisma.role.findUnique({ where: { id: payload.roleId } });
    if (!role) {
      throwError('NOT_FOUND');
    }

    const profile = await this.fabLdap.lookupByUid(uid);
    if (!profile) {
      throwError('VALIDATION_ERROR', { reason: 'LDAP_USER_NOT_FOUND', uid });
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
      },
    });

    const uniqueEmail = await this.resolveUniqueEmail(preferredEmail, uid, existing?.id);
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
              payload.specialtyId !== undefined ? payload.specialtyId : undefined,
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

  async simulateAccess(params: { userId?: string; roleId?: string }) {
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

    throwError('VALIDATION_ERROR', { reason: 'MISSING_PARAMS' });
  }

  private async buildAccessFromUser(user: UserAccessPayload): Promise<RbacUser> {
    const roles = user.roles.map((userRole) => ({
      id: userRole.role.id,
      name: userRole.role.name,
      wildcard: userRole.role.wildcard,
      constraintsTemplateJson: userRole.role.constraintsTemplateJson as Record<string, unknown> | null,
      flagsJson: userRole.role.flagsJson as Record<string, unknown> | null,
      permissions: userRole.role.permissions.map((rp) => ({
        resource: rp.permission.resource,
        action: rp.permission.action,
        scope: rp.permission.scope,
      })),
    }));
    const normalizedRoles = new Set(roles.map((role) => normalizeRoleName(role.name)));
    const hasNationalScope =
      normalizedRoles.has(normalizeRoleName(ROLE_TI)) ||
      normalizedRoles.has(normalizeRoleName(ROLE_COORDENACAO_CIPAVD)) ||
      normalizedRoles.has(normalizeRoleName(ROLE_COMANDANTE_COMGEP));
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
      ? await this.listPermissionEntries(
          roleWildcard ? undefined : { resource: { in: enabledOverrideResources } },
        )
      : [];

    const rolePermissions = this.dedupePermissions(
      roles.flatMap((role) => role.permissions),
    );
    const basePermissions = roleWildcard
      ? this.dedupePermissions([...rolePermissions, ...catalogPermissions])
      : rolePermissions;
    const permissions = this.applyModuleAccessOverrides(
      basePermissions,
      moduleAccessOverrides,
      catalogPermissions,
    );

    const executiveFromRole = roles.some(
      (role) => role.flagsJson && (role.flagsJson as { executive_hide_pii?: boolean }).executive_hide_pii === true,
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
    };
  }

  private async listPermissionEntries(where?: Prisma.PermissionWhereInput) {
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
    const items = await this.prisma.permission.findMany({
      select: { resource: true },
      distinct: ['resource'],
      orderBy: { resource: 'asc' },
    });
    return items.map((item) => item.resource);
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
    const value = String(email ?? '').trim().toLowerCase();
    return value || null;
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
