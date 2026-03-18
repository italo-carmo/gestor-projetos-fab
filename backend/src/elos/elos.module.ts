import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { ElosController, OrgChartController } from './elos.controller';
import { ElosService } from './elos.service';

@Module({
  imports: [RbacModule, AuthModule],
  controllers: [ElosController, OrgChartController],
  providers: [ElosService],
})
export class ElosModule {}
