import { Module } from '@nestjs/common';
import { ChecklistsController, ChecklistItemStatusController } from './checklists.controller';
import { ChecklistsService } from './checklists.service';

@Module({
  controllers: [ChecklistsController, ChecklistItemStatusController],
  providers: [ChecklistsService],
})
export class ChecklistsModule {}

