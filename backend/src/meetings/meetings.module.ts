import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { TasksModule } from '../tasks/tasks.module';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';

@Module({
  imports: [RbacModule, TasksModule],
  controllers: [MeetingsController],
  providers: [MeetingsService],
})
export class MeetingsModule {}

