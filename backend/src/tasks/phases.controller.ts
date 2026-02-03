import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { TasksService } from './tasks.service';

@Controller('phases')
@UseGuards(JwtAuthGuard, RbacGuard)
export class PhasesController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @RequirePermission('phases', 'view')
  async list() {
    const items = await this.tasks.listPhases();
    return { items };
  }
}
