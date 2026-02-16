import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { NoticesController } from './notices.controller';
import { NoticesService } from './notices.service';

@Module({
  imports: [RbacModule],
  controllers: [NoticesController],
  providers: [NoticesService],
})
export class NoticesModule {}

