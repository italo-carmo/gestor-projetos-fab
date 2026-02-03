import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { PhasesController } from './phases.controller';
import { TaskTemplatesController } from './task-templates.controller';
import { TaskInstancesController } from './task-instances.controller';
import { DashboardsController } from './dashboards.controller';

@Module({
  controllers: [PhasesController, TaskTemplatesController, TaskInstancesController, DashboardsController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
