import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { throwError } from '../common/http-error';

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
      roleId?: string | null;
    },
  ) {
    if (payload.roleId !== undefined && payload.roleId !== null) {
      const roleExists = await this.prisma.role.findUnique({
        where: { id: payload.roleId },
        select: { id: true },
      });
      if (!roleExists) {
        throwError('NOT_FOUND');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          eloRoleId:
            payload.eloRoleId !== undefined ? payload.eloRoleId : undefined,
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
