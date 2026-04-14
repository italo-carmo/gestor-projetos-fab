import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { CpcaCommissionController } from './cpca-commission.controller';
import { CpcaCommissionService } from './cpca-commission.service';
import { CpcaController } from './cpca.controller';
import { CpcaService } from './cpca.service';

@Module({
  imports: [RbacModule],
  controllers: [CpcaController, CpcaCommissionController],
  providers: [CpcaService, CpcaCommissionService],
  exports: [CpcaService, CpcaCommissionService],
})
export class CpcaModule {}
