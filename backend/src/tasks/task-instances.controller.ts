import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RbacUser } from '../rbac/rbac.types';
import { TaskAssignDto } from './dto/task-assign.dto';
import { TaskProgressDto } from './dto/task-progress.dto';
import { TaskStatusDto } from './dto/task-status.dto';
import { TasksService } from './tasks.service';

@Controller('task-instances')
@UseGuards(JwtAuthGuard, RbacGuard)
export class TaskInstancesController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @RequirePermission('task_instances', 'view')
  list(
    @Query('localityId') localityId: string | undefined,
    @Query('phaseId') phaseId: string | undefined,
    @Query('status') status: string | undefined,
    @Query('assigneeId') assigneeId: string | undefined,
    @Query('dueFrom') dueFrom: string | undefined,
    @Query('dueTo') dueTo: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.tasks.listTaskInstances({
      localityId,
      phaseId,
      status,
      assigneeId,
      dueFrom,
      dueTo,
      page,
      pageSize,
    }, user);
  }

  @Put(':id/status')
  @RequirePermission('task_instances', 'update')
  updateStatus(@Param('id') id: string, @Body() dto: TaskStatusDto, @CurrentUser() user: RbacUser) {
    return this.tasks.updateStatus(id, dto.status as any, user);
  }

  @Put(':id/progress')
  @RequirePermission('task_instances', 'update')
  updateProgress(
    @Param('id') id: string,
    @Body() dto: TaskProgressDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.tasks.updateProgress(id, dto.progressPercent, user);
  }

  @Put(':id/assign')
  @RequirePermission('task_instances', 'assign')
  assign(@Param('id') id: string, @Body() dto: TaskAssignDto, @CurrentUser() user: RbacUser) {
    return this.tasks.assignTask(id, dto.assignedToId ?? null, user);
  }

  @Get('gantt')
  @RequirePermission('gantt', 'view')
  gantt(
    @Query('localityId') localityId: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.tasks.getGantt({ localityId, from, to }, user);
  }

  @Get('calendar')
  @RequirePermission('calendar', 'view')
  calendar(@Query('year') year: string, @CurrentUser() user: RbacUser) {
    return this.tasks.getCalendar(Number(year), user);
  }
}
