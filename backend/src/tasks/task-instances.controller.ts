import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import type { RbacUser } from '../rbac/rbac.types';
import { TaskAssignDto } from './dto/task-assign.dto';
import { TaskCommentDto } from './dto/task-comment.dto';
import { TaskEloRoleDto } from './dto/task-elo-role.dto';
import { TaskMeetingDto } from './dto/task-meeting.dto';
import { TaskProgressDto } from './dto/task-progress.dto';
import { TaskSpecialtyDto } from './dto/task-specialty.dto';
import { TaskStatusDto } from './dto/task-status.dto';
import { TasksService } from './tasks.service';

@Controller('task-instances')
@UseGuards(JwtAuthGuard, RbacGuard)
export class TaskInstancesController {
  constructor(private readonly tasks: TasksService) {}

  @Get('assignees')
  @RequirePermission('task_instances', 'assign')
  listAssignees(@Query('localityId') localityId: string | undefined, @CurrentUser() user: RbacUser) {
    return this.tasks.listAssignees(localityId, user);
  }

  @Get()
  @RequirePermission('task_instances', 'view')
  list(
    @Query('localityId') localityId: string | undefined,
    @Query('phaseId') phaseId: string | undefined,
    @Query('status') status: string | undefined,
    @Query('assigneeId') assigneeId: string | undefined,
    @Query('assigneeIds') assigneeIds: string | undefined,
    @Query('dueFrom') dueFrom: string | undefined,
    @Query('dueTo') dueTo: string | undefined,
    @Query('meetingId') meetingId: string | undefined,
    @Query('eloRoleId') eloRoleId: string | undefined,
    @Query('specialtyId') specialtyId: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.tasks.listTaskInstances({
      localityId,
      phaseId,
      status,
      assigneeId,
      assigneeIds,
      dueFrom,
      dueTo,
      meetingId,
      eloRoleId,
      specialtyId,
      page,
      pageSize,
    }, user);
  }

  @Get(':id/comments')
  @RequirePermission('task_instances', 'view')
  comments(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.tasks.listComments(id, user);
  }

  @Post(':id/comments')
  @RequirePermission('task_instances', 'update')
  addComment(@Param('id') id: string, @Body() dto: TaskCommentDto, @CurrentUser() user: RbacUser) {
    return this.tasks.addComment(id, dto.text, user);
  }

  @Post(':id/comments/seen')
  @RequirePermission('task_instances', 'view')
  markCommentsSeen(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.tasks.markCommentsSeen(id, user);
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
    return this.tasks.assignTask(id, dto, user);
  }

  @Put(':id/meeting')
  @RequirePermission('task_instances', 'update')
  updateMeeting(@Param('id') id: string, @Body() dto: TaskMeetingDto, @CurrentUser() user: RbacUser) {
    return this.tasks.updateTaskMeeting(id, dto.meetingId ?? null, user);
  }

  @Put(':id/elo-role')
  @RequirePermission('task_instances', 'update')
  updateEloRole(@Param('id') id: string, @Body() dto: TaskEloRoleDto, @CurrentUser() user: RbacUser) {
    return this.tasks.updateTaskEloRole(id, dto.eloRoleId ?? null, user);
  }

  @Put(':id/specialty')
  @RequirePermission('task_instances', 'update')
  updateSpecialty(@Param('id') id: string, @Body() dto: TaskSpecialtyDto, @CurrentUser() user: RbacUser) {
    return this.tasks.updateTaskSpecialty(id, dto.specialtyId ?? null, user);
  }

  @Put('batch/assign')
  @RequirePermission('task_instances', 'assign')
  batchAssign(
    @Body() body: { ids: string[]; assignedToId: string | null; assigneeIds?: string[] },
    @CurrentUser() user: RbacUser,
  ) {
    return this.tasks.batchAssign(body.ids ?? [], body.assignedToId ?? null, body.assigneeIds ?? [], user);
  }

  @Put('batch/status')
  @RequirePermission('task_instances', 'update')
  batchStatus(@Body() body: { ids: string[]; status: string }, @CurrentUser() user: RbacUser) {
    return this.tasks.batchStatus(body.ids ?? [], body.status as any, user);
  }

  @Delete(':id')
  @RequirePermission('task_instances', 'update')
  remove(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.tasks.deleteTaskInstance(id, user);
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
  calendar(
    @Query('year') year: string,
    @Query('localityId') localityId: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.tasks.getCalendar(Number(year), localityId, user);
  }

  @Get(':id')
  @RequirePermission('task_instances', 'view')
  getById(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.tasks.getTaskInstanceById(id, user);
  }
}
