import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { MenuUpdatesController } from './menu-updates.controller';
import { MenuUpdatesService } from './menu-updates.service';

@Module({
  imports: [RbacModule],
  controllers: [MenuUpdatesController],
  providers: [MenuUpdatesService],
})
export class MenuUpdatesModule {}
