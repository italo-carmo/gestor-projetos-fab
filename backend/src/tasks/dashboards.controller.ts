import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { throwError } from '../common/http-error';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { hasAnyRole, hasNationalManagementScope, ROLE_TI } from '../rbac/role-access';
import type { RbacUser } from '../rbac/rbac.types';
import { TasksService } from './tasks.service';
import { UpdateDashboardNationalCardDto } from './dto/update-dashboard-national-card.dto';

@Controller()
@UseGuards(JwtAuthGuard, RbacGuard)
export class DashboardsController {
  constructor(private readonly tasks: TasksService) {}

  @Get('localities/:id/progress')
  @RequirePermission('dashboard', 'view')
  progress(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.tasks.getLocalityProgress(id, user);
  }

  @Get('dashboard/national')
  @RequirePermission('dashboard', 'view')
  national(
    @Query('localityId') localityId: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    if (!hasNationalManagementScope(user)) {
      throwError('RBAC_FORBIDDEN');
    }
    return this.tasks.getDashboardNational(user, localityId);
  }

  @Put('dashboard/national/cards/:id')
  @RequirePermission('dashboard', 'view')
  updateNationalCard(
    @Param('id') id: string,
    @Body() dto: UpdateDashboardNationalCardDto,
    @CurrentUser() user: RbacUser,
  ) {
    if (!hasAnyRole(user, [ROLE_TI])) {
      throwError('RBAC_FORBIDDEN');
    }
    return this.tasks.updateDashboardNationalCardSetting(id, dto, user);
  }

  @Get('dashboard/recruits')
  @RequirePermission('dashboard', 'view')
  recruits(
    @Query('localityId') localityId: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.tasks.getDashboardRecruits(user, localityId);
  }

  @Get('dashboard/executive')
  @RequirePermission('dashboard', 'view')
  executive(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('phaseId') phaseId: string | undefined,
    @Query('threshold') threshold: string | undefined,
    @Query('command') command: string | undefined,
    @Query('localityId') localityId: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.tasks.getDashboardExecutive(
      { from, to, phaseId, threshold, command, localityId },
      user,
    );
  }

  @Get('dashboard/executive/debug-specialties')
  @RequirePermission('dashboard', 'view')
  async debugSpecialties(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    const result = await this.tasks.getDashboardExecutive(
      { from, to, threshold: '70' },
      user,
    );
    const psicologia = result.specialties.items.find((s: any) =>
      s.specialtyName?.toLowerCase().includes('psicologia'),
    );
    return {
      specialties: result.specialties.items.map((s: any) => ({
        specialtyName: s.specialtyName,
        count: s.count,
        specialtyId: s.specialtyId,
      })),
      psicologia: {
        count: psicologia?.count || 0,
        specialtyId: psicologia?.specialtyId,
        specialtyName: psicologia?.specialtyName,
      },
      total: (result.specialties.items as any[]).reduce(
        (sum: number, s: any) => sum + s.count,
        0,
      ),
      totalActivities: result.summary.totalActivities,
    };
  }

  @Get('dashboard/executive/debug-psicologia')
  @RequirePermission('dashboard', 'view')
  async debugPsicologia(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.tasks.debugPsicologiaActivities({ from, to }, user);
  }

  @Get('dashboard/executive/debug-counts')
  @RequirePermission('dashboard', 'view')
  async debugCounts(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    const dbCounts = await this.tasks.debugActivityCounts({ from, to }, user);
    const dashboardResult = await this.tasks.getDashboardExecutive(
      { from, to, threshold: '70' },
      user,
    );

    const dashboardPsicologia = dashboardResult.specialties.items.find(
      (s: any) => s.specialtyName?.toLowerCase().includes('psicologia'),
    );
    const dashboardCommission = dashboardResult.specialties.items.find(
      (s: any) =>
        s.specialtyName?.toLowerCase().includes('comissão') ||
        s.specialtyName?.toLowerCase().includes('cipavd'),
    );

    return {
      database: {
        psicologia: dbCounts.counts.psicologia,
        commission: dbCounts.counts.commission,
        total: dbCounts.counts.total,
      },
      dashboard: {
        psicologia: dashboardPsicologia?.count || 0,
        commission: dashboardCommission?.count || 0,
        allSpecialties: dashboardResult.specialties.items.map((s: any) => ({
          name: s.specialtyName,
          count: s.count,
          specialtyId: s.specialtyId,
        })),
      },
      specialties: dbCounts.specialties,
      bySpecialtyId: dbCounts.bySpecialtyId,
      activitiesSample: dbCounts.activitiesSample,
      match: {
        psicologia:
          dbCounts.counts.psicologia === (dashboardPsicologia?.count || 0),
        commission:
          dbCounts.counts.commission === (dashboardCommission?.count || 0),
      },
      expected: {
        psicologia: 3,
        commission: 7,
      },
      status: {
        psicologiaOk: (dashboardPsicologia?.count || 0) === 3,
        commissionOk: (dashboardCommission?.count || 0) === 7,
      },
    };
  }
}
