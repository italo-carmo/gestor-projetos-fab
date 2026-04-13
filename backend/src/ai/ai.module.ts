import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { StrategicModule } from '../strategic/strategic.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [RbacModule, StrategicModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
