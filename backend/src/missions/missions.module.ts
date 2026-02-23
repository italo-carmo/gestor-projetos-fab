import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { MissionsController } from './missions.controller';
import { MissionsService } from './missions.service';

@Module({
  imports: [RbacModule],
  controllers: [MissionsController],
  providers: [MissionsService],
})
export class MissionsModule {}
