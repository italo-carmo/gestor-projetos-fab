import { Module } from '@nestjs/common';
import { ActivitiesModule } from '../activities/activities.module';
import { LitellmModule } from '../llm/litellm.module';
import { MissionsModule } from '../missions/missions.module';
import { RbacModule } from '../rbac/rbac.module';
import { StrategicModule } from '../strategic/strategic.module';
import { TasksModule } from '../tasks/tasks.module';
import { AiController } from './ai.controller';
import { AiAssistantService } from './ai-assistant.service';
import { AiService } from './ai.service';

@Module({
  imports: [
    RbacModule,
    StrategicModule,
    MissionsModule,
    ActivitiesModule,
    TasksModule,
    LitellmModule,
  ],
  controllers: [AiController],
  providers: [AiService, AiAssistantService],
})
export class AiModule {}
