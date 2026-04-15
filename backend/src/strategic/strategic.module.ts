import { Module } from '@nestjs/common';
import { BiModule } from '../bi/bi.module';
import { RbacModule } from '../rbac/rbac.module';
import { StrategicController } from './strategic.controller';
import { StrategicService } from './strategic.service';

@Module({
  imports: [RbacModule, BiModule],
  controllers: [StrategicController],
  providers: [StrategicService],
  exports: [StrategicService],
})
export class StrategicModule {}
