import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import type { RbacUser } from '../rbac/rbac.types';
import { GenerateInstancesDto } from './dto/generate-instances.dto';
import { TaskTemplateDto } from './dto/task-template.dto';
import { TasksService } from './tasks.service';

@Controller('task-templates')
@UseGuards(JwtAuthGuard, RbacGuard)
export class TaskTemplatesController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @RequirePermission('task_templates', 'view')
  async list() {
    const items = await this.tasks.listTaskTemplates();
    return { items };
  }

  @Post()
  @RequirePermission('task_templates', 'create')
  create(@Body() dto: TaskTemplateDto, @CurrentUser() user: RbacUser) {
    return this.tasks.createTaskTemplate({
      title: dto.title,
      description: dto.description ?? null,
      phase: { connect: { id: dto.phaseId } },
      specialty: dto.specialtyId ? { connect: { id: dto.specialtyId } } : undefined,
      eloRole: dto.eloRoleId ? { connect: { id: dto.eloRoleId } } : undefined,
      appliesToAllLocalities: dto.appliesToAllLocalities,
      reportRequiredDefault: dto.reportRequiredDefault,
    }, user);
  }

  @Post(':id/generate-instances')
  @RequirePermission('task_templates', 'create')
  generateInstances(
    @Param('id') id: string,
    @Body() dto: GenerateInstancesDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.tasks.generateInstances(
      id,
      {
        localities: dto.localities,
        reportRequired: dto.reportRequired,
        priority: dto.priority,
        meetingId: dto.meetingId ?? null,
        assignedToId: dto.assignedToId ?? null,
        assigneeIds: dto.assigneeIds ?? [],
      },
      user,
    );
  }

  @Post(':id/clone')
  @RequirePermission('task_templates', 'create')
  clone(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.tasks.cloneTaskTemplate(id, user);
  }
}
