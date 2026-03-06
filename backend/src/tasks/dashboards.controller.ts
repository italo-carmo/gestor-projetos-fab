import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { throwError } from '../common/http-error';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { hasNationalManagementScope } from '../rbac/role-access';
import type { RbacUser } from '../rbac/rbac.types';
import { TasksService } from './tasks.service';

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
    return this.tasks.getDashboardExecutive({ from, to, phaseId, threshold, command, localityId }, user);
  }

  @Get('dashboard/executive/debug-specialties')
  @RequirePermission('dashboard', 'view')
  async debugSpecialties(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    const result = await this.tasks.getDashboardExecutive({ from, to, threshold: '70' }, user);
    const psicologia = result.specialties.items.find((s: any) => 
      s.specialtyName?.toLowerCase().includes('psicologia')
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
      total: result.specialties.items.reduce((sum: number, s: any) => sum + s.count, 0),
      totalActivities: result.summary.totalActivities,
    };
  }
}
