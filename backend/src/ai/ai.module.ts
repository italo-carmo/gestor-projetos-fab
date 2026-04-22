import { Module } from '@nestjs/common';
import { ActivitiesModule } from '../activities/activities.module';
import { CpcaModule } from '../cpca/cpca.module';
import { KnowledgeBasesModule } from '../knowledge-bases/knowledge-bases.module';
import { LitellmModule } from '../llm/litellm.module';
import { MissionsModule } from '../missions/missions.module';
import { RbacModule } from '../rbac/rbac.module';
import { SocialCommunicationModule } from '../social-communication/social-communication.module';
import { StrategicModule } from '../strategic/strategic.module';
import { TasksModule } from '../tasks/tasks.module';
import { AiController } from './ai.controller';
import { AiAssistantService } from './ai-assistant.service';
import { AiReportService } from './ai-report.service';
import { AiService } from './ai.service';

@Module({
  imports: [
    RbacModule,
    StrategicModule,
    CpcaModule,
    MissionsModule,
    ActivitiesModule,
    KnowledgeBasesModule,
    TasksModule,
    SocialCommunicationModule,
    LitellmModule,
  ],
  controllers: [AiController],
  providers: [AiService, AiAssistantService, AiReportService],
})
export class AiModule {}
