import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { throwError } from '../common/http-error';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { canEditRecruitsByRole, isNationalCommissionMember, ROLE_TI, hasRole } from '../rbac/role-access';
import type { RbacUser } from '../rbac/rbac.types';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeText } from '../common/sanitize';
import { CreateLocalityDto } from './dto/create-locality.dto';
import { UpdateLocalityRecruitsDto } from './dto/update-locality-recruits.dto';
import { UpdateLocalityDto } from './dto/update-locality.dto';

@Controller('localities')
@UseGuards(JwtAuthGuard, RbacGuard)
export class LocalitiesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('localities', 'view')
  async list(@CurrentUser() user: RbacUser) {
    const canViewAll = isNationalCommissionMember(user) || hasRole(user, ROLE_TI);
    const where = !canViewAll && user?.localityId ? { id: user.localityId } : undefined;
    const items = await this.prisma.locality.findMany({ where, orderBy: { name: 'asc' } });
    return { items };
  }

  @Post()
  @RequirePermission('localities', 'create')
  async create(@Body() dto: CreateLocalityDto) {
    return this.prisma.locality.create({
      data: {
        code: sanitizeText(dto.code),
        name: sanitizeText(dto.name),
        commandName: dto.commandName ? sanitizeText(dto.commandName) : null,
        commanderName: dto.commanderName ? sanitizeText(dto.commanderName) : null,
        individualMeetingDate: dto.individualMeetingDate ? new Date(dto.individualMeetingDate) : null,
        visitDate: dto.visitDate ? new Date(dto.visitDate) : null,
        recruitsFemaleCountCurrent: dto.recruitsFemaleCountCurrent ?? null,
        notes: dto.notes ? sanitizeText(dto.notes) : null,
      },
    });
  }

  @Put(':id')
  @RequirePermission('localities', 'update')
  async update(@Param('id') id: string, @Body() dto: UpdateLocalityDto, @CurrentUser() user: RbacUser) {
    this.assertLocalityAccess(id, user);
    this.assertRecruitsMutationAccess(id, user, dto.recruitsFemaleCountCurrent);
    const currentLocality = await this.prisma.locality.findUnique({
      where: { id },
      select: { recruitsFemaleCountCurrent: true },
    });
    if (!currentLocality) throwError('NOT_FOUND');

    const updated = await this.prisma.locality.update({
      where: { id },
      data: {
        code: dto.code ? sanitizeText(dto.code) : undefined,
        name: dto.name ? sanitizeText(dto.name) : undefined,
        commandName: dto.commandName ? sanitizeText(dto.commandName) : dto.commandName === null ? null : undefined,
        commanderName: dto.commanderName ? sanitizeText(dto.commanderName) : dto.commanderName === null ? null : undefined,
        individualMeetingDate: dto.individualMeetingDate ? new Date(dto.individualMeetingDate) : dto.individualMeetingDate === null ? null : undefined,
        visitDate: dto.visitDate ? new Date(dto.visitDate) : dto.visitDate === null ? null : undefined,
        recruitsFemaleCountCurrent: dto.recruitsFemaleCountCurrent ?? undefined,
        notes: dto.notes ? sanitizeText(dto.notes) : dto.notes === null ? null : undefined,
      },
    });
    if (dto.recruitsFemaleCountCurrent !== undefined && dto.recruitsFemaleCountCurrent !== null) {
      await this.registerRecruitsHistory(
        id,
        dto.recruitsFemaleCountCurrent,
        currentLocality.recruitsFemaleCountCurrent ?? 0,
        null,
      );
    }
    return updated;
  }

  @Put(':id/recruits')
  @RequirePermission('dashboard', 'view')
  async updateRecruits(
    @Param('id') id: string,
    @Body() dto: UpdateLocalityRecruitsDto,
    @CurrentUser() user: RbacUser,
  ) {
    this.assertRecruitsMutationAccess(id, user, dto.recruitsFemaleCountCurrent);
    const currentLocality = await this.prisma.locality.findUnique({
      where: { id },
      select: { recruitsFemaleCountCurrent: true },
    });
    if (!currentLocality) throwError('NOT_FOUND');
    const previousCount = currentLocality.recruitsFemaleCountCurrent ?? 0;

    const updated = await this.prisma.locality.update({
      where: { id },
      data: {
        recruitsFemaleCountCurrent: dto.recruitsFemaleCountCurrent,
      },
    });

    await this.registerRecruitsHistory(
      id,
      dto.recruitsFemaleCountCurrent,
      previousCount,
      dto.dismissalReason ?? null,
      true,
    );

    return updated;
  }

  @Delete(':id')
  @RequirePermission('localities', 'delete')
  async remove(@Param('id') id: string) {
    await this.prisma.locality.delete({ where: { id } });
    return { ok: true };
  }

  private assertLocalityAccess(localityId: string, user?: RbacUser) {
    const bypassLocalityConstraint = isNationalCommissionMember(user) || hasRole(user, ROLE_TI);
    if (bypassLocalityConstraint) return;
    if (!user?.localityId) return;
    if (user.localityId !== localityId) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private assertRecruitsMutationAccess(
    localityId: string,
    user: RbacUser | undefined,
    recruitsFemaleCountCurrent: number | null | undefined,
  ) {
    if (recruitsFemaleCountCurrent === undefined || recruitsFemaleCountCurrent === null) return;
    if (!canEditRecruitsByRole(user, localityId)) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private async registerRecruitsHistory(
    localityId: string,
    nextCount: number,
    previousCount: number,
    dismissalReason?: string | null,
    enforceDismissalReason = false,
  ) {
    const normalizedReason = dismissalReason
      ? sanitizeText(String(dismissalReason)).trim()
      : '';
    const turnoverCount = Math.max(0, previousCount - nextCount);
    if (enforceDismissalReason && turnoverCount > 0 && !normalizedReason) {
      throwError('VALIDATION_ERROR', {
        field: 'dismissalReason',
        reason: 'DISMISSAL_REASON_REQUIRED',
      });
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    await (this.prisma.recruitsHistory as any).upsert({
      where: {
        localityId_date: { localityId, date: today },
      },
      create: {
        localityId,
        date: today,
        recruitsFemaleCount: nextCount,
        turnoverCount,
        dismissalReason: turnoverCount > 0 ? normalizedReason || null : null,
      },
      update: {
        recruitsFemaleCount: nextCount,
        turnoverCount,
        dismissalReason: turnoverCount > 0 ? normalizedReason || null : null,
      },
    });
  }
}
