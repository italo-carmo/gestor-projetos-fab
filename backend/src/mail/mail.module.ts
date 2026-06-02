import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { MailAdminController } from './mail-admin.controller';
import { MailService } from './mail.service';

@Module({
  imports: [RbacModule],
  controllers: [MailAdminController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
