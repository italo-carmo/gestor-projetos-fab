import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RbacUser } from '../rbac/rbac.types';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { MeetingDecisionDto } from './dto/meeting-decision.dto';
import { GenerateMeetingTasksDto } from './dto/generate-meeting-tasks.dto';
import { MeetingsService } from './meetings.service';

@Controller('meetings')
@UseGuards(JwtAuthGuard, RbacGuard)
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get()
  @RequirePermission('meetings', 'view')
  list(
    @Query('status') status: string | undefined,
    @Query('scope') scope: string | undefined,
    @Query('localityId') localityId: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.meetings.list({ status, scope, localityId, from, to, page, pageSize }, user);
  }

  @Post()
  @RequirePermission('meetings', 'create')
  create(@Body() dto: CreateMeetingDto, @CurrentUser() user: RbacUser) {
    return this.meetings.create(dto, user);
  }

  @Put(':id')
  @RequirePermission('meetings', 'update')
  update(@Param('id') id: string, @Body() dto: UpdateMeetingDto, @CurrentUser() user: RbacUser) {
    return this.meetings.update(id, dto, user);
  }

  @Post(':id/decisions')
  @RequirePermission('meetings', 'update')
  addDecision(@Param('id') id: string, @Body() dto: MeetingDecisionDto, @CurrentUser() user: RbacUser) {
    return this.meetings.addDecision(id, dto.text, user);
  }

  @Post(':id/generate-tasks')
  @RequirePermission('tasks', 'generate_from_meeting')
  generateTasks(@Param('id') id: string, @Body() dto: GenerateMeetingTasksDto, @CurrentUser() user: RbacUser) {
    return this.meetings.generateTasks(id, dto, user);
  }
}
