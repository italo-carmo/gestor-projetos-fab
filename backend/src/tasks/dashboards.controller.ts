import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RbacUser } from '../rbac/rbac.types';
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
}
