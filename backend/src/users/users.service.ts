import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { throwError } from '../common/http-error';
import { canonicalRoleName } from '../rbac/role-access';

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

function normalizeRoleName(roleName: string | null | undefined) {
  return String(roleName ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function roleRequiresLocality(roleName: string | null | undefined) {
  return LOCALITY_REQUIRED_ROLE_NAMES.has(normalizeRoleName(roleName));
}

function roleRequiresSpecialty(roleName: string | null | undefined) {
  return SPECIALTY_REQUIRED_ROLE_NAMES.has(normalizeRoleName(roleName));
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private toRoleResponse(role: { id: string; name: string }) {
    return {
      id: role.id,
      name: canonicalRoleName(role.name),
    };
  }

  private mapUserRoles<T extends { roles: Array<{ role: { id: string; name: string } }> }>(user: T) {
    return {
      ...user,
      roles: user.roles.map((item) => ({
        role: this.toRoleResponse(item.role),
      })),
    };
  }

  private readonly authInclude = {
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
  } as const;

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: this.authInclude,
    });
  }

  findByLdapUid(ldapUid: string) {
    return this.prisma.user.findUnique({
      where: { ldapUid },
      include: this.authInclude,
    });
  }

  findForAuth(identifier: string) {
    const value = String(identifier ?? '').trim();
    const normalizedEmail = value.toLowerCase();

    return this.prisma.user.findFirst({
      where: {
        OR: [{ ldapUid: value }, { email: normalizedEmail }],
      },
      include: this.authInclude,
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: this.authInclude,
    });
  }

  async list() {
    const users = await this.prisma.user.findMany({
      where: {
        ldapUid: { not: null },
        roles: { some: {} },
      },
      select: {
        id: true,
        name: true,
        email: true,
        ldapUid: true,
        localityId: true,
        specialtyId: true,
        eloRoleId: true,
        eloRole: { select: { id: true, code: true, name: true } },
        roles: {
          orderBy: { role: { name: 'asc' } },
          select: {
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    return users
      .filter((user) => String(user.ldapUid ?? '').trim().length > 0)
      .map((user) => this.mapUserRoles(user));
  }

  async update(
    id: string,
    payload: {
      eloRoleId?: string | null;
      localityId?: string | null;
      specialtyId?: string | null;
      roleId?: string | null;
      roleIds?: string[];
    },
  ) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        localityId: true,
        specialtyId: true,
        eloRoleId: true,
        roles: {
          select: {
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
    if (!existingUser) {
      throwError('NOT_FOUND');
    }

    const requestedRoleIdsRaw =
      payload.roleIds !== undefined
        ? payload.roleIds
        : payload.roleId !== undefined
          ? payload.roleId
            ? [payload.roleId]
            : []
          : undefined;

    let targetRoleNames: string[] = [];
    let requestedRoleIds: string[] | undefined = undefined;
    if (requestedRoleIdsRaw !== undefined) {
      requestedRoleIds = Array.from(
        new Set(
          requestedRoleIdsRaw
            .map((value) => String(value ?? '').trim())
            .filter(Boolean),
        ),
      );

      if (requestedRoleIds.length > 0) {
        const roleRecords = await this.prisma.role.findMany({
          where: { id: { in: requestedRoleIds } },
          select: { id: true, name: true },
        });
        if (roleRecords.length !== requestedRoleIds.length) {
          throwError('NOT_FOUND');
        }
        targetRoleNames = roleRecords.map((item) => item.name);
      }
    } else {
      targetRoleNames = existingUser.roles.map((item) => item.role.name);
    }

    const targetLocalityId =
      payload.localityId !== undefined ? payload.localityId : existingUser.localityId;
    if (targetRoleNames.some((roleName) => roleRequiresLocality(roleName)) && !targetLocalityId) {
      throwError('USER_LOCAL_ROLE_REQUIRES_LOCALITY');
    }
    const targetSpecialtyId =
      payload.specialtyId !== undefined ? payload.specialtyId : existingUser.specialtyId;
    const targetEloRoleId =
      payload.eloRoleId !== undefined ? payload.eloRoleId : existingUser.eloRoleId;
    if (
      targetRoleNames.some((roleName) => roleRequiresSpecialty(roleName)) &&
      !targetSpecialtyId &&
      !targetEloRoleId
    ) {
      throwError('USER_SPECIALTY_ROLE_REQUIRES_SPECIALTY');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          eloRoleId:
            payload.eloRoleId !== undefined ? payload.eloRoleId : undefined,
          specialtyId:
            payload.specialtyId !== undefined ? payload.specialtyId : undefined,
          localityId:
            payload.localityId !== undefined ? payload.localityId : undefined,
        },
      });

      if (requestedRoleIds !== undefined) {
        await tx.userRole.deleteMany({
          where: { userId: id },
        });

        if (requestedRoleIds.length > 0) {
          await tx.userRole.createMany({
            data: requestedRoleIds.map((roleId) => ({
              userId: id,
              roleId,
            })),
            skipDuplicates: true,
          });
        }
      }
    });

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        ldapUid: true,
        localityId: true,
        specialtyId: true,
        eloRoleId: true,
        eloRole: { select: { id: true, code: true, name: true } },
        roles: {
          orderBy: { role: { name: 'asc' } },
          select: {
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
    return user ? this.mapUserRoles(user) : null;
  }

  async removeRole(userId: string, roleId: string) {
    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.userRole.deleteMany({
        where: {
          userId,
          roleId,
        },
      });

      const targetUser = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          ldapUid: true,
          _count: {
            select: { roles: true },
          },
        },
      });

      let userRemoved = false;
      let userDeactivated = false;

      if (
        targetUser &&
        targetUser._count.roles === 0 &&
        String(targetUser.ldapUid ?? '').trim().length === 0
      ) {
        await tx.userModuleAccessOverride.deleteMany({ where: { userId } });
        await tx.refreshToken.deleteMany({ where: { userId } });

        try {
          await tx.user.delete({ where: { id: userId } });
          userRemoved = true;
        } catch {
          await tx.user.update({
            where: { id: userId },
            data: {
              isActive: false,
              localityId: null,
              specialtyId: null,
              eloRoleId: null,
            },
          });
          userDeactivated = true;
        }
      }

      return {
        ok: true,
        removed: deleted.count,
        userRemoved,
        userDeactivated,
      };
    });
  }
}
