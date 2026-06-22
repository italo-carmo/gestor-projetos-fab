import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { RbacModule } from '../rbac/rbac.module';
import {
  CertificatesController,
  PublicCertificatesController,
} from './certificates.controller';
import { CertificatesService } from './certificates.service';

@Module({
  imports: [RbacModule, MailModule],
  controllers: [CertificatesController, PublicCertificatesController],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
