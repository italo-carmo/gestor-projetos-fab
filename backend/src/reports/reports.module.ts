import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RbacModule } from '../rbac/rbac.module';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [RbacModule, JwtModule.register({})],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
