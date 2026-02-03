import { Injectable } from '@nestjs/common';
import { PermissionScope, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { throwError } from '../common/http-error';
import { AuditService } from '../audit/audit.service';
import { RbacUser } from './rbac.types';

@Injectable()
export class RbacService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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
      },
    });

    if (!user) {
      throwError('RBAC_FORBIDDEN');
    }

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

    const executiveFromRole = roles.some(
      (role) => role.flagsJson && (role.flagsJson as any).executive_hide_pii === true,
    );

    return {
      id: user.id,
      email: user.email,
      localityId: user.localityId,
      specialtyId: user.specialtyId,
      executiveHidePii: user.executiveHidePii || executiveFromRole,
      roles,
    };
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
        flagsJson: role.flagsJson,
        constraintsTemplateJson: role.constraintsTemplateJson,
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
            flagsJson: role.flags ?? undefined,
            constraintsTemplateJson: role.constraintsTemplate ?? undefined,
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
            flagsJson: role.flags ?? existing.flagsJson,
            constraintsTemplateJson: role.constraintsTemplate ?? existing.constraintsTemplateJson,
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
      diffJson: { mode, updatedRoles, createdRoles },
    });

    return { updatedRoles, createdRoles, warnings: [] };
  }
}
