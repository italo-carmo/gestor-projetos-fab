import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { ElosController, OrgChartController } from './elos.controller';
import { ElosService } from './elos.service';

@Module({
  imports: [RbacModule],
  controllers: [ElosController, OrgChartController],
  providers: [ElosService],
})
export class ElosModule {}

