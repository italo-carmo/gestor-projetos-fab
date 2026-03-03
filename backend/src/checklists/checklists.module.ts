import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { TasksModule } from '../tasks/tasks.module';
import { ActivitiesModule } from '../activities/activities.module';
import { ChecklistsController, ChecklistItemStatusController } from './checklists.controller';
import { ChecklistsService } from './checklists.service';

@Module({
  imports: [RbacModule, TasksModule, ActivitiesModule],
  controllers: [ChecklistsController, ChecklistItemStatusController],
  providers: [ChecklistsService],
  exports: [ChecklistsService],
})
export class ChecklistsModule {}

