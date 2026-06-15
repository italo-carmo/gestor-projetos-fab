import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { CipavdReportsController } from './cipavd-reports.controller';
import { CipavdReportsService } from './cipavd-reports.service';

@Module({
  imports: [RbacModule],
  controllers: [CipavdReportsController],
  providers: [CipavdReportsService],
  exports: [CipavdReportsService],
})
export class CipavdReportsModule {}
