import { Module } from '@nestjs/common';
import { MenuUpdatesController } from './menu-updates.controller';
import { MenuUpdatesService } from './menu-updates.service';

@Module({
  controllers: [MenuUpdatesController],
  providers: [MenuUpdatesService],
})
export class MenuUpdatesModule {}
