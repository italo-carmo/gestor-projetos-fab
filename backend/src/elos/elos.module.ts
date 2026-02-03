import { Module } from '@nestjs/common';
import { ElosController, OrgChartController } from './elos.controller';
import { ElosService } from './elos.service';

@Module({
  controllers: [ElosController, OrgChartController],
  providers: [ElosService],
})
export class ElosModule {}

