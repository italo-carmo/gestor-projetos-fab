import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { throwError } from '../common/http-error';

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

  list() {
    return this.prisma.user.findMany({
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
  }

  async update(
    id: string,
    payload: {
      eloRoleId?: string | null;
      localityId?: string | null;
      specialtyId?: string | null;
      roleId?: string | null;
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

    let targetRoleName: string | null = null;
    if (payload.roleId !== undefined && payload.roleId !== null) {
      const roleExists = await this.prisma.role.findUnique({
        where: { id: payload.roleId },
        select: { id: true, name: true },
      });
      if (!roleExists) {
        throwError('NOT_FOUND');
      }
      targetRoleName = roleExists.name;
    } else {
      targetRoleName = existingUser.roles[0]?.role?.name ?? null;
    }

    const targetLocalityId =
      payload.localityId !== undefined ? payload.localityId : existingUser.localityId;
    if (roleRequiresLocality(targetRoleName) && !targetLocalityId) {
      throwError('USER_LOCAL_ROLE_REQUIRES_LOCALITY');
    }
    const targetSpecialtyId =
      payload.specialtyId !== undefined ? payload.specialtyId : existingUser.specialtyId;
    const targetEloRoleId =
      payload.eloRoleId !== undefined ? payload.eloRoleId : existingUser.eloRoleId;
    if (roleRequiresSpecialty(targetRoleName) && !targetSpecialtyId && !targetEloRoleId) {
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

      if (payload.roleId !== undefined) {
        await tx.userRole.deleteMany({
          where: { userId: id },
        });

        if (payload.roleId) {
          await tx.userRole.create({
            data: {
              userId: id,
              roleId: payload.roleId,
            },
          });
        }
      }
    });

    return this.prisma.user.findUnique({
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
  }

  async removeRole(userId: string, roleId: string) {
    const deleted = await this.prisma.userRole.deleteMany({
      where: {
        userId,
        roleId,
      },
    });

    return {
      ok: true,
      removed: deleted.count,
    };
  }
}
