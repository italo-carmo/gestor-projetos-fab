import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { PermissionScope, Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { throwError } from '../common/http-error';
import { sanitizeText } from '../common/sanitize';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { hasPermission } from '../rbac/role-access';
import type { RbacUser } from '../rbac/rbac.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOmDto } from './dto/create-om.dto';
import { UpdateOmDto } from './dto/update-om.dto';
import { UpdateOmsHasCpcaBatchDto } from './dto/update-oms-has-cpca-batch.dto';
import { hasAnyRole, ROLE_TI } from '../rbac/role-access';

@Controller('oms')
@UseGuards(JwtAuthGuard, RbacGuard)
export class OmsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('cpca_coverage', 'view', PermissionScope.NATIONAL)
  async list(@CurrentUser() user: RbacUser) {
    const canViewAll = hasPermission(
      user,
      'cpca_coverage',
      'view',
      PermissionScope.NATIONAL,
    );
    const where: Prisma.OmWhereInput = {};
    if (!canViewAll) {
      if (user?.omId) {
        where.id = user.omId;
      } else {
        where.id = '__none__';
      }
    }

    const items = await this.prisma.om.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        cpcaCommissionPresident: {
          select: {
            id: true,
            assignedAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        cpcaCommissionMembers: {
          select: {
            id: true,
            createdAt: true,
            userId: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                ldapUid: true,
              },
            },
            addedByUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { user: { name: 'asc' } },
        },
        cpcaCoverageAsManager: {
          select: {
            managedOm: {
              select: {
                id: true,
                code: true,
                name: true,
                uf: true,
                hasCpca: true,
              },
            },
          },
          orderBy: { managedOm: { name: 'asc' } },
        },
        cpcaCoverageAsManaged: {
          select: {
            managerOm: {
              select: { id: true, code: true, name: true },
            },
          },
          take: 1,
        },
      },
    });

    return {
      items: items.map((item) => {
        const presidentUserId = String(
          item.cpcaCommissionPresident?.user?.id ?? '',
        ).trim();
        const cpcaMembersCount = (item.cpcaCommissionMembers ?? []).filter(
          (member) => String(member.userId ?? '').trim() !== presidentUserId,
        ).length;
        const cpcaMembers = (item.cpcaCommissionMembers ?? [])
          .filter(
            (member) => String(member.userId ?? '').trim() !== presidentUserId,
          )
          .map((member) => ({
            id: member.id,
            createdAt: member.createdAt,
            user: member.user,
            addedByUser: member.addedByUser,
          }));

        return {
          ...item,
          cpcaMembersCount,
          cpcaMembers,
          cpcaManagedLocalities: item.cpcaCoverageAsManager.map((entry) => ({
            id: entry.managedOm.id,
            code: entry.managedOm.code,
            name: entry.managedOm.name,
            uf: entry.managedOm.uf,
            hasCpca: entry.managedOm.hasCpca,
          })),
          cpcaManagedLocalityIds: item.cpcaCoverageAsManager.map(
            (entry) => entry.managedOm.id,
          ),
          cpcaManagedByLocality: item.cpcaCoverageAsManaged[0]?.managerOm
            ? {
                id: item.cpcaCoverageAsManaged[0].managerOm.id,
                code: item.cpcaCoverageAsManaged[0].managerOm.code,
                name: item.cpcaCoverageAsManaged[0].managerOm.name,
              }
            : null,
          cpcaManagedOms: item.cpcaCoverageAsManager.map((entry) => ({
            id: entry.managedOm.id,
            code: entry.managedOm.code,
            name: entry.managedOm.name,
            uf: entry.managedOm.uf,
            hasCpca: entry.managedOm.hasCpca,
          })),
          cpcaManagedOmIds: item.cpcaCoverageAsManager.map(
            (entry) => entry.managedOm.id,
          ),
          cpcaManagedByOm: item.cpcaCoverageAsManaged[0]?.managerOm
            ? {
                id: item.cpcaCoverageAsManaged[0].managerOm.id,
                code: item.cpcaCoverageAsManaged[0].managerOm.code,
                name: item.cpcaCoverageAsManaged[0].managerOm.name,
              }
            : null,
          currentPresident: item.cpcaCommissionPresident
            ? {
                id: item.cpcaCommissionPresident.id,
                assignedAt: item.cpcaCommissionPresident.assignedAt,
                user: item.cpcaCommissionPresident.user,
              }
            : null,
          cpcaCommissionPresident: undefined,
          cpcaCommissionMembers: undefined,
          cpcaCoverageAsManager: undefined,
          cpcaCoverageAsManaged: undefined,
        };
      }),
    };
  }

  @Get('catalog')
  @RequirePermission('localities', 'view')
  async listCatalog() {
    const items = await this.prisma.om.findMany({
      select: { id: true, code: true, name: true, uf: true, hasCpca: true },
      orderBy: { name: 'asc' },
    });
    return { items };
  }

  @Post()
  @RequirePermission('cpca_coverage', 'create', PermissionScope.NATIONAL)
  async create(@Body() dto: CreateOmDto) {
    return this.prisma.om.create({
      data: {
        code: sanitizeText(dto.code).toUpperCase(),
        name: sanitizeText(dto.name),
        uf: dto.uf ? sanitizeText(dto.uf).toUpperCase().slice(0, 2) : null,
        hasCpca: dto.hasCpca ?? false,
        notes: dto.notes ? sanitizeText(dto.notes) : null,
      },
    });
  }

  @Put('batch/has-cpca')
  @RequirePermission('cpca_coverage', 'update', PermissionScope.NATIONAL)
  async updateHasCpcaBatch(@Body() dto: UpdateOmsHasCpcaBatchDto) {
    const ids = Array.from(
      new Set(
        (dto.ids ?? [])
          .map((value) => String(value ?? '').trim())
          .filter(Boolean),
      ),
    );
    if (ids.length === 0) {
      throwError('VALIDATION_ERROR', { field: 'ids', reason: 'required' });
    }

    const result = await this.prisma.om.updateMany({
      where: { id: { in: ids } },
      data: { hasCpca: Boolean(dto.hasCpca) },
    });

    return { updatedCount: result.count, hasCpca: Boolean(dto.hasCpca), ids };
  }

  @Put(':id')
  @RequirePermission('cpca_coverage', 'update', PermissionScope.NATIONAL)
  async update(@Param('id') id: string, @Body() dto: UpdateOmDto) {
    const existing = await this.prisma.om.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throwError('NOT_FOUND');

    return this.prisma.om.update({
      where: { id },
      data: {
        code: dto.code ? sanitizeText(dto.code).toUpperCase() : undefined,
        name: dto.name ? sanitizeText(dto.name) : undefined,
        uf:
          dto.uf !== undefined
            ? dto.uf
              ? sanitizeText(dto.uf).toUpperCase().slice(0, 2)
              : null
            : undefined,
        hasCpca: dto.hasCpca !== undefined ? Boolean(dto.hasCpca) : undefined,
        notes:
          dto.notes !== undefined
            ? sanitizeText(dto.notes ?? '') || null
            : undefined,
      },
    });
  }

  @Delete(':id')
  @RequirePermission('cpca_coverage', 'delete', PermissionScope.NATIONAL)
  async remove(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    if (!hasAnyRole(user, [ROLE_TI])) {
      throwError('RBAC_FORBIDDEN');
    }

    const existing = await this.prisma.om.findUnique({
      where: { id },
      select: { id: true, code: true, name: true },
    });
    if (!existing) throwError('NOT_FOUND');

    const [
      usersCount,
      cpcaCasesCount,
      presidentsCount,
      membersCount,
      requestsCount,
      managesCount,
      managedByCount,
    ] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { omId: id } }),
      this.prisma.cpcComplaintCase.count({ where: { omId: id } }),
      this.prisma.cpcaCommissionPresident.count({ where: { omId: id } }),
      this.prisma.cpcaCommissionMember.count({ where: { omId: id } }),
      this.prisma.cpcaPresidentSelfRegistration.count({ where: { omId: id } }),
      this.prisma.cpcaCommissionCoverageOm.count({
        where: { managerOmId: id },
      }),
      this.prisma.cpcaCommissionCoverageOm.count({
        where: { managedOmId: id },
      }),
    ]);

    await this.prisma.$transaction(async (tx) => {
      await tx.cpcaCommissionCoverageOm.deleteMany({
        where: {
          OR: [{ managerOmId: id }, { managedOmId: id }],
        },
      });
      await tx.user.updateMany({
        where: { omId: id },
        data: { omId: null },
      });
      await tx.cpcComplaintCase.updateMany({
        where: { omId: id },
        data: { omId: null },
      });
      await tx.cpcaCommissionPresident.updateMany({
        where: { omId: id },
        data: { omId: null },
      });
      await tx.cpcaCommissionMember.updateMany({
        where: { omId: id },
        data: { omId: null },
      });
      await tx.cpcaPresidentSelfRegistration.updateMany({
        where: { omId: id },
        data: { omId: null },
      });
      await tx.om.delete({ where: { id } });
    });

    return {
      ok: true,
      detached: {
        users: usersCount,
        cpcaCases: cpcaCasesCount,
        cpcaCommissionPresidents: presidentsCount,
        cpcaCommissionMembers: membersCount,
        cpcaPresidentRequests: requestsCount,
        cpcaCoverageAsManager: managesCount,
        cpcaCoverageAsManaged: managedByCount,
      },
      deletedOm: {
        id: existing.id,
        code: existing.code,
        name: existing.name,
      },
    };
  }
}
