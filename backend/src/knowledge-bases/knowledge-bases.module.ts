import { Module } from '@nestjs/common';
import { CipavdReportsModule } from '../cipavd-reports/cipavd-reports.module';
import { RbacModule } from '../rbac/rbac.module';
import { KnowledgeBasesController } from './knowledge-bases.controller';
import { KnowledgeBasesService } from './knowledge-bases.service';

@Module({
  imports: [RbacModule, CipavdReportsModule],
  controllers: [KnowledgeBasesController],
  providers: [KnowledgeBasesService],
  exports: [KnowledgeBasesService],
})
export class KnowledgeBasesModule {}
