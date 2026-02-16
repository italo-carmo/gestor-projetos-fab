import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { TasksModule } from '../tasks/tasks.module';
import { ChecklistsModule } from '../checklists/checklists.module';
import { ExportsController } from './exports.controller';

@Module({
  imports: [RbacModule, TasksModule, ChecklistsModule],
  controllers: [ExportsController],
})
export class ExportsModule {}

