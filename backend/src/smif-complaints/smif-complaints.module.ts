import { Module } from '@nestjs/common';
import { CpcaModule } from '../cpca/cpca.module';
import { RbacModule } from '../rbac/rbac.module';
import { SmifComplaintsController } from './smif-complaints.controller';
import { SmifComplaintsService } from './smif-complaints.service';

@Module({
  imports: [RbacModule, CpcaModule],
  controllers: [SmifComplaintsController],
  providers: [SmifComplaintsService],
})
export class SmifComplaintsModule {}
