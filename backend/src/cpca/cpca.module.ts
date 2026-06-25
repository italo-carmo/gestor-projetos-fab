import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { RbacModule } from '../rbac/rbac.module';
import { SettingsModule } from '../settings/settings.module';
import { CpcaChecklistController } from './cpca-checklist.controller';
import { CpcaChecklistService } from './cpca-checklist.service';
import { CpcaCommissionController } from './cpca-commission.controller';
import { CpcaCommissionService } from './cpca-commission.service';
import { CpcaEmailController } from './cpca-email.controller';
import { CpcaEmailService } from './cpca-email.service';
import { CpcaController } from './cpca.controller';
import { ComplaintSummaryPrivacyService } from './complaint-summary-privacy.service';
import { CpcaService } from './cpca.service';

@Module({
  imports: [RbacModule, MailModule, SettingsModule],
  controllers: [
    CpcaController,
    CpcaCommissionController,
    CpcaChecklistController,
    CpcaEmailController,
  ],
  providers: [
    CpcaService,
    CpcaCommissionService,
    CpcaChecklistService,
    CpcaEmailService,
    ComplaintSummaryPrivacyService,
  ],
  exports: [
    CpcaService,
    CpcaCommissionService,
    CpcaChecklistService,
    CpcaEmailService,
    ComplaintSummaryPrivacyService,
  ],
})
export class CpcaModule {}
