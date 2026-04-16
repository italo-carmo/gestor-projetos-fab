import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import {
  MissionsChecklistUploadsController,
  MissionsController,
} from './missions.controller';
import { MissionsService } from './missions.service';

@Module({
  imports: [RbacModule],
  controllers: [MissionsController, MissionsChecklistUploadsController],
  providers: [MissionsService],
  exports: [MissionsService],
})
export class MissionsModule {}
