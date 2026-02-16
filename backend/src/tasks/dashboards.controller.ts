import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
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
  national(@CurrentUser() user: RbacUser) {
    return this.tasks.getDashboardNational(user);
  }

  @Get('dashboard/recruits')
  @RequirePermission('dashboard', 'view')
  recruits(@CurrentUser() user: RbacUser) {
    return this.tasks.getDashboardRecruits(user);
  }

  @Get('dashboard/executive')
  @RequirePermission('dashboard', 'view')
  executive(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('phaseId') phaseId: string | undefined,
    @Query('threshold') threshold: string | undefined,
    @Query('command') command: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.tasks.getDashboardExecutive({ from, to, phaseId, threshold, command }, user);
  }
}
