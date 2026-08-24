import { Injectable } from '@nestjs/common';
import { PermissionScope, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { throwError } from '../common/http-error';
import { sanitizeText } from '../common/sanitize';
import type { RbacUser } from '../rbac/rbac.types';
import { PrismaService } from '../prisma/prisma.service';

const ODGSA_ROLE_PERMISSIONS = [
  {
    resource: 'cpca_cases',
    action: 'view',
    scope: PermissionScope.LOCALITY,
  },
  {
    resource: 'cpca_dashboard',
    action: 'view',
    scope: PermissionScope.LOCALITY,
  },
  {
    resource: 'odgsa_oms',
    action: 'view',
    scope: PermissionScope.LOCALITY,
  },
  {
    resource: 'odgsa_oms',
    action: 'update',
    scope: PermissionScope.LOCALITY,
  },
] as const;

type OdgsaAdminRecord = Prisma.OdgsaGetPayload<{
  include: {
    role: {
      select: {
        id: true;
        name: true;
        description: true;
        _count: { select: { users: true } };
      };
    };
    _count: { select: { oms: true } };
  };
}>;

@Injectable()
export class OdgsaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listAdmin() {
    const items = await this.prisma.odgsa.findMany({
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
      include: {
        role: {
          select: {
            id: true,
            name: true,
            description: true,
            _count: { select: { users: true } },
          },
        },
        _count: { select: { oms: true } },
      },
    });

    return {
      items: items.map((item) => this.serializeOdgsa(item)),
    };
  }

  async create(input: { code: string; name: string }, actorUserId?: string) {
    const code = this.normalizeCode(input.code);
    const name = this.normalizeName(input.name);
    const roleName = this.buildRoleName(code);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const permissions = await tx.permission.findMany({
          where: {
            OR: ODGSA_ROLE_PERMISSIONS.map((permission) => ({
              resource: permission.resource,
              action: permission.action,
              scope: permission.scope,
            })),
          },
          select: { id: true },
        });
        if (permissions.length !== ODGSA_ROLE_PERMISSIONS.length) {
          throwError('VALIDATION_ERROR', {
            reason: 'ODGSA_PERMISSION_CATALOG_INCOMPLETE',
          });
        }

        const role = await tx.role.create({
          data: {
            name: roleName,
            description: this.buildRoleDescription(code, name),
            isSystemRole: true,
            wildcard: false,
            flagsJson: { accessProfile: 'ODGSA' },
            constraintsTemplateJson: { odgsaId: '$role.odgsaId' },
          },
        });
        const odgsa = await tx.odgsa.create({
          data: { code, name, roleId: role.id },
        });

        await Promise.all([
          tx.role.update({
            where: { id: role.id },
            data: {
              flagsJson: { accessProfile: 'ODGSA', odgsaId: odgsa.id },
            },
          }),
          tx.rolePermission.createMany({
            data: permissions.map((permission) => ({
              roleId: role.id,
              permissionId: permission.id,
            })),
          }),
        ]);

        return tx.odgsa.findUniqueOrThrow({
          where: { id: odgsa.id },
          include: {
            role: {
              select: {
                id: true,
                name: true,
                description: true,
                _count: { select: { users: true } },
              },
            },
            _count: { select: { oms: true } },
          },
        });
      });

      await this.audit.log({
        userId: actorUserId,
        resource: 'odgsa_admin',
        action: 'create',
        entityId: created.id,
        diffJson: { code, name, roleId: created.roleId },
      });

      return this.serializeOdgsa(created);
    } catch (error) {
      this.rethrowKnownConstraint(error, 'ODGSA_CODE_OR_ROLE_ALREADY_EXISTS');
    }
  }

  async update(
    id: string,
    input: { code?: string; name?: string },
    actorUserId?: string,
  ) {
    const existing = await this.prisma.odgsa.findUnique({
      where: { id },
      select: { id: true, code: true, name: true, roleId: true },
    });
    if (!existing) throwError('NOT_FOUND');

    const code =
      input.code !== undefined ? this.normalizeCode(input.code) : existing.code;
    const name =
      input.name !== undefined ? this.normalizeName(input.name) : existing.name;

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.odgsa.update({
          where: { id },
          data: { code, name },
        });
        await tx.role.update({
          where: { id: existing.roleId },
          data: {
            name: this.buildRoleName(code),
            description: this.buildRoleDescription(code, name),
            isSystemRole: true,
            wildcard: false,
            flagsJson: { accessProfile: 'ODGSA', odgsaId: id },
            constraintsTemplateJson: { odgsaId: '$role.odgsaId' },
          },
        });

        return tx.odgsa.findUniqueOrThrow({
          where: { id },
          include: {
            role: {
              select: {
                id: true,
                name: true,
                description: true,
                _count: { select: { users: true } },
              },
            },
            _count: { select: { oms: true } },
          },
        });
      });

      await this.audit.log({
        userId: actorUserId,
        resource: 'odgsa_admin',
        action: 'update',
        entityId: id,
        diffJson: {
          previous: { code: existing.code, name: existing.name },
          next: { code, name },
        },
      });

      return this.serializeOdgsa(updated);
    } catch (error) {
      this.rethrowKnownConstraint(error, 'ODGSA_CODE_OR_ROLE_ALREADY_EXISTS');
    }
  }

  async getMine(user: RbacUser) {
    const odgsa = await this.resolveCurrentOdgsa(user);
    const assignedOms = await this.prisma.odgsaOm.count({
      where: { odgsaId: odgsa.id },
    });
    return {
      id: odgsa.id,
      code: odgsa.code,
      name: odgsa.name,
      role: odgsa.role,
      assignedOms,
    };
  }

  async listMineOms(user: RbacUser) {
    const odgsa = await this.resolveCurrentOdgsa(user);
    const items = await this.prisma.om.findMany({
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        uf: true,
        hasCpca: true,
        odgsaAssignment: {
          select: {
            odgsaId: true,
            assignedAt: true,
            odgsa: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    return {
      odgsa: {
        id: odgsa.id,
        code: odgsa.code,
        name: odgsa.name,
        role: odgsa.role,
      },
      items: items.map((item) => {
        const assignment = item.odgsaAssignment;
        const assignmentStatus = !assignment
          ? 'UNASSIGNED'
          : assignment.odgsaId === odgsa.id
            ? 'OWN'
            : 'OTHER';
        return {
          id: item.id,
          code: item.code,
          name: item.name,
          uf: item.uf,
          hasCpca: item.hasCpca,
          assignmentStatus,
          assignedAt: assignment?.assignedAt ?? null,
          assignedOdgsa:
            assignmentStatus === 'OTHER' ? (assignment?.odgsa ?? null) : null,
        };
      }),
    };
  }

  async updateMineOms(
    user: RbacUser,
    input: { action: 'ASSIGN' | 'UNASSIGN'; omIds: string[] },
  ) {
    const odgsa = await this.resolveCurrentOdgsa(user);
    const omIds = this.normalizeIds(input.omIds);
    if (omIds.length === 0) {
      throwError('VALIDATION_ERROR', { field: 'omIds', reason: 'required' });
    }

    const oms = await this.prisma.om.findMany({
      where: { id: { in: omIds } },
      select: { id: true, code: true },
    });
    if (oms.length !== omIds.length) {
      throwError('NOT_FOUND', { reason: 'ODGSA_OM_NOT_FOUND' });
    }

    let updatedCount = 0;
    try {
      if (input.action === 'ASSIGN') {
        updatedCount = await this.prisma.$transaction(async (tx) => {
          const existingAssignments = await tx.odgsaOm.findMany({
            where: { omId: { in: omIds } },
            select: { omId: true, odgsaId: true },
          });
          const conflicts = existingAssignments.filter(
            (assignment) => assignment.odgsaId !== odgsa.id,
          );
          if (conflicts.length > 0) {
            throwError('VALIDATION_ERROR', {
              reason: 'OM_ALREADY_ASSIGNED_TO_ANOTHER_ODGSA',
              omIds: conflicts.map((assignment) => assignment.omId),
            });
          }

          const alreadyAssigned = new Set(
            existingAssignments.map((assignment) => assignment.omId),
          );
          const toCreate = omIds.filter((omId) => !alreadyAssigned.has(omId));
          if (toCreate.length === 0) return 0;

          const result = await tx.odgsaOm.createMany({
            data: toCreate.map((omId) => ({
              odgsaId: odgsa.id,
              omId,
              assignedById: user.id,
            })),
          });
          return result.count;
        });
      } else {
        const result = await this.prisma.odgsaOm.deleteMany({
          where: { odgsaId: odgsa.id, omId: { in: omIds } },
        });
        updatedCount = result.count;
      }
    } catch (error) {
      this.rethrowKnownConstraint(
        error,
        'OM_ALREADY_ASSIGNED_TO_ANOTHER_ODGSA',
      );
    }

    await this.audit.log({
      userId: user.id,
      resource: 'odgsa_oms',
      action: input.action === 'ASSIGN' ? 'assign_batch' : 'unassign_batch',
      entityId: odgsa.id,
      diffJson: {
        odgsaId: odgsa.id,
        odgsaCode: odgsa.code,
        omIds,
        omCodes: oms.map((om) => om.code),
        updatedCount,
      },
    });

    return {
      ok: true,
      action: input.action,
      requestedCount: omIds.length,
      updatedCount,
      odgsaId: odgsa.id,
    };
  }

  private async resolveCurrentOdgsa(user: RbacUser) {
    const activeRoleIds = this.normalizeIds(
      (user.roles ?? []).map((role) => role.id),
    );
    if (activeRoleIds.length === 0) throwError('RBAC_FORBIDDEN');

    const odgsa = await this.prisma.odgsa.findFirst({
      where: { roleId: { in: activeRoleIds } },
      select: {
        id: true,
        code: true,
        name: true,
        role: { select: { id: true, name: true } },
      },
    });
    if (!odgsa) throwError('RBAC_FORBIDDEN');
    return odgsa;
  }

  private serializeOdgsa(item: OdgsaAdminRecord) {
    return {
      id: item.id,
      code: item.code,
      name: item.name,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      role: {
        id: item.role.id,
        name: item.role.name,
        description: item.role.description,
      },
      usersCount: Number(item.role?._count?.users ?? 0),
      omsCount: Number(item._count?.oms ?? 0),
    };
  }

  private normalizeCode(value: string) {
    const normalized = sanitizeText(String(value ?? ''))
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
    if (!normalized) {
      throwError('VALIDATION_ERROR', { field: 'code', reason: 'required' });
    }
    return normalized;
  }

  private normalizeName(value: string) {
    const normalized = sanitizeText(String(value ?? ''))
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized) {
      throwError('VALIDATION_ERROR', { field: 'name', reason: 'required' });
    }
    return normalized;
  }

  private normalizeIds(values: string[]) {
    return Array.from(
      new Set(
        (values ?? [])
          .map((value) => String(value ?? '').trim())
          .filter(Boolean),
      ),
    );
  }

  private buildRoleName(code: string) {
    return `ODGSA · ${code}`;
  }

  private buildRoleDescription(code: string, name: string) {
    return `Acompanhamento somente leitura das denúncias CPCA das OMs vinculadas ao ODGSA ${code} - ${name}`;
  }

  private rethrowKnownConstraint(error: unknown, reason: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throwError('VALIDATION_ERROR', { reason });
    }
    throw error;
  }
}
