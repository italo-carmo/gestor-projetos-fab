import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  update(id: string, payload: { eloRoleId?: string | null }) {
    return this.prisma.user.update({
      where: { id },
      data: { eloRoleId: payload.eloRoleId ?? undefined },
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
}
