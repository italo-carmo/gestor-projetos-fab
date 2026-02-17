import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { BiController } from './bi.controller';
import { BiService } from './bi.service';

@Module({
  imports: [RbacModule],
  controllers: [BiController],
  providers: [BiService],
})
export class BiModule {}
