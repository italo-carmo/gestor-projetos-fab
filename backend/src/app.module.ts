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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
