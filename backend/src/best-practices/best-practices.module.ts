import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { BestPracticesController } from './best-practices.controller';
import { BestPracticesService } from './best-practices.service';

@Module({
  imports: [RbacModule],
  controllers: [BestPracticesController],
  providers: [BestPracticesService],
})
export class BestPracticesModule {}


