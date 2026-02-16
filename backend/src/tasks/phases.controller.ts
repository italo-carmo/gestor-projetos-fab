import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import type { RbacUser } from '../rbac/rbac.types';
import { TasksService } from './tasks.service';
import { UpdatePhaseDto } from './dto/update-phase.dto';

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

  @Patch(':id')
  @RequirePermission('phases', 'update')
  update(@Param('id') id: string, @Body() dto: UpdatePhaseDto, @CurrentUser() user: RbacUser) {
    return this.tasks.updatePhase(id, dto, user);
  }
}
