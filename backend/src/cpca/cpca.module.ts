import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { CpcaChecklistController } from './cpca-checklist.controller';
import { CpcaChecklistService } from './cpca-checklist.service';
import { CpcaCommissionController } from './cpca-commission.controller';
import { CpcaCommissionService } from './cpca-commission.service';
import { CpcaController } from './cpca.controller';
import { CpcaService } from './cpca.service';

@Module({
  imports: [RbacModule],
  controllers: [
    CpcaController,
    CpcaCommissionController,
    CpcaChecklistController,
  ],
  providers: [CpcaService, CpcaCommissionService, CpcaChecklistService],
  exports: [CpcaService, CpcaCommissionService, CpcaChecklistService],
})
export class CpcaModule {}
