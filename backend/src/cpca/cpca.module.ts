import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { RbacModule } from '../rbac/rbac.module';
import { SettingsModule } from '../settings/settings.module';
import { CpcaChecklistController } from './cpca-checklist.controller';
import { CpcaChecklistService } from './cpca-checklist.service';
import { CpcaCommissionController } from './cpca-commission.controller';
import { CpcaCommissionService } from './cpca-commission.service';
import { CpcaController } from './cpca.controller';
import { ComplaintSummaryPrivacyService } from './complaint-summary-privacy.service';
import { CpcaService } from './cpca.service';

@Module({
  imports: [RbacModule, MailModule, SettingsModule],
  controllers: [
    CpcaController,
    CpcaCommissionController,
    CpcaChecklistController,
  ],
  providers: [
    CpcaService,
    CpcaCommissionService,
    CpcaChecklistService,
    ComplaintSummaryPrivacyService,
  ],
  exports: [
    CpcaService,
    CpcaCommissionService,
    CpcaChecklistService,
    ComplaintSummaryPrivacyService,
  ],
})
export class CpcaModule {}
