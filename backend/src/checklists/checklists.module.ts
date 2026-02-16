import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { ChecklistsController, ChecklistItemStatusController } from './checklists.controller';
import { ChecklistsService } from './checklists.service';

@Module({
  imports: [RbacModule],
  controllers: [ChecklistsController, ChecklistItemStatusController],
  providers: [ChecklistsService],
  exports: [ChecklistsService],
})
export class ChecklistsModule {}

