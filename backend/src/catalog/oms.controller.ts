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

@Controller('oms')
@UseGuards(JwtAuthGuard, RbacGuard)
export class OmsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('localities', 'view')
  async list(@CurrentUser() user: RbacUser) {
    const canViewAll = hasPermission(
      user,
      'localities',
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
      items: items.map((item) => ({
        ...item,
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
        cpcaCoverageAsManager: undefined,
        cpcaCoverageAsManaged: undefined,
      })),
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
  @RequirePermission('localities', 'create')
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
  @RequirePermission('localities', 'update')
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
  @RequirePermission('localities', 'update')
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
        hasCpca:
          dto.hasCpca !== undefined ? Boolean(dto.hasCpca) : undefined,
        notes: dto.notes !== undefined ? sanitizeText(dto.notes ?? '') || null : undefined,
      },
    });
  }

  @Delete(':id')
  @RequirePermission('localities', 'delete')
  async remove(@Param('id') id: string) {
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
      this.prisma.cpcaCommissionCoverageOm.count({ where: { managerOmId: id } }),
      this.prisma.cpcaCommissionCoverageOm.count({ where: { managedOmId: id } }),
    ]);

    const blockers = [
      usersCount ? `Usuários (${usersCount})` : null,
      cpcaCasesCount ? `Denúncias (${cpcaCasesCount})` : null,
      presidentsCount ? `Presidentes CPCA (${presidentsCount})` : null,
      membersCount ? `Membros CPCA (${membersCount})` : null,
      requestsCount ? `Solicitações de presidente (${requestsCount})` : null,
      managesCount ? `Cobertura CPCA como gestora (${managesCount})` : null,
      managedByCount ? `Cobertura CPCA como gerenciada (${managedByCount})` : null,
    ].filter(Boolean);

    if (blockers.length > 0) {
      throwError('VALIDATION_ERROR', {
        reason: 'OM_HAS_LINKED_DATA',
        labels: blockers,
        omCode: existing.code,
        omName: existing.name,
      });
    }

    await this.prisma.om.delete({ where: { id } });
    return { ok: true };
  }
}
