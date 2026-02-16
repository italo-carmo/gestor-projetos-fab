import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { KpisController } from './kpis.controller';
import { KpisService } from './kpis.service';

@Module({
  imports: [RbacModule],
  controllers: [KpisController],
  providers: [KpisService],
})
export class KpisModule {}

