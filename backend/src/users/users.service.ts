import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
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
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
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
  }

  list() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        localityId: true,
        specialtyId: true,
        eloRoleId: true,
        eloRole: { select: { id: true, code: true, name: true } },
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
        localityId: true,
        specialtyId: true,
        eloRoleId: true,
        eloRole: { select: { id: true, code: true, name: true } },
      },
    });
  }
}
