import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { StrategicController } from './strategic.controller';
import { StrategicService } from './strategic.service';

@Module({
  imports: [RbacModule],
  controllers: [StrategicController],
  providers: [StrategicService],
  exports: [StrategicService],
})
export class StrategicModule {}
