import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { RbacModule } from './rbac/rbac.module';
import { AuditModule } from './audit/audit.module';
import { TasksModule } from './tasks/tasks.module';
import { ReportsModule } from './reports/reports.module';
import { NoticesModule } from './notices/notices.module';
import { MeetingsModule } from './meetings/meetings.module';
import { ChecklistsModule } from './checklists/checklists.module';
import { ElosModule } from './elos/elos.module';
import { ExportsModule } from './exports/exports.module';
import { HealthModule } from './health/health.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { CatalogModule } from './catalog/catalog.module';
import { KpisModule } from './kpis/kpis.module';
import { SearchModule } from './search/search.module';
import { ActivitiesModule } from './activities/activities.module';
import { DocumentsModule } from './documents/documents.module';
import { BiModule } from './bi/bi.module';
import { FabLdapModule } from './ldap/fab-ldap.module';
import { MissionsModule } from './missions/missions.module';
import { SocialCommunicationModule } from './social-communication/social-communication.module';
import { CpcaModule } from './cpca/cpca.module';
import { LibraryModule } from './library/library.module';
import { BestPracticesModule } from './best-practices/best-practices.module';
import { LessonsLearnedModule } from './lessons-learned/lessons-learned.module';
import { SmifComplaintsModule } from './smif-complaints/smif-complaints.module';
import { MenuUpdatesModule } from './menu-updates/menu-updates.module';
import { StrategicModule } from './strategic/strategic.module';
import { LitellmModule } from './llm/litellm.module';
import { SettingsModule } from './settings/settings.module';
import { AiModule } from './ai/ai.module';
import { KnowledgeBasesModule } from './knowledge-bases/knowledge-bases.module';
import { ManualsModule } from './manuals/manuals.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LitellmModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    UsersModule,
    AuthModule,
    RbacModule,
    AuditModule,
    TasksModule,
    ReportsModule,
    NoticesModule,
    MeetingsModule,
    ChecklistsModule,
    ElosModule,
    ExportsModule,
    HealthModule,
    CatalogModule,
    KpisModule,
    SearchModule,
    ActivitiesModule,
    DocumentsModule,
    BiModule,
    FabLdapModule,
    MissionsModule,
    SocialCommunicationModule,
    CpcaModule,
    LibraryModule,
    BestPracticesModule,
    LessonsLearnedModule,
    SmifComplaintsModule,
    MenuUpdatesModule,
    StrategicModule,
    SettingsModule,
    MailModule,
    KnowledgeBasesModule,
    ManualsModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
