import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RbacModule } from '../rbac/rbac.module';
import { DocumentCollaborationService } from './document-collaboration.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [JwtModule.register({}), RbacModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentCollaborationService],
})
export class DocumentsModule {}
