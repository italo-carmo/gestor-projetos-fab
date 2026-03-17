import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { LessonsLearnedController } from './lessons-learned.controller';
import { LessonsLearnedService } from './lessons-learned.service';

@Module({
  imports: [RbacModule],
  controllers: [LessonsLearnedController],
  providers: [LessonsLearnedService],
})
export class LessonsLearnedModule {}
