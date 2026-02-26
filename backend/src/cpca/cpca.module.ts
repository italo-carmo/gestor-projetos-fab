import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { CpcaController } from './cpca.controller';
import { CpcaService } from './cpca.service';

@Module({
  imports: [RbacModule],
  controllers: [CpcaController],
  providers: [CpcaService],
  exports: [CpcaService],
})
export class CpcaModule {}
