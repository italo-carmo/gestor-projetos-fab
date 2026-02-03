import { Module } from '@nestjs/common';
import { ExportsController } from './exports.controller';
import { TasksModule } from '../tasks/tasks.module';
import { ChecklistsModule } from '../checklists/checklists.module';

@Module({
  imports: [TasksModule, ChecklistsModule],
  controllers: [ExportsController],
})
export class ExportsModule {}

