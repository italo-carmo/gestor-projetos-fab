import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { BiNormalizationController } from './bi-normalization.controller';
import { BiNormalizationService } from './bi-normalization.service';
import { BiPdfService } from './bi-pdf.service';
import { BiBestPracticesCycleController } from './bi-best-practices-cycle.controller';
import { BiBestPracticesCycleService } from './bi-best-practices-cycle.service';
import { BiCpcaMeetingController } from './bi-cpca-meeting.controller';
import { BiCpcaMeetingService } from './bi-cpca-meeting.service';
import { BiGsdEvaluationController } from './bi-gsd-evaluation.controller';
import { BiGsdEvaluationService } from './bi-gsd-evaluation.service';
import { BiDomesticViolenceController } from './bi-domestic-violence.controller';
import { BiDomesticViolenceService } from './bi-domestic-violence.service';
import { BiRecruitsController } from './bi-recruits.controller';
import { BiRecruitsService } from './bi-recruits.service';
import { BiController } from './bi.controller';
import { BiService } from './bi.service';

@Module({
  imports: [RbacModule],
  controllers: [
    BiController,
    BiNormalizationController,
    BiDomesticViolenceController,
    BiRecruitsController,
    BiBestPracticesCycleController,
    BiCpcaMeetingController,
    BiGsdEvaluationController,
  ],
  providers: [
    BiService,
    BiNormalizationService,
    BiPdfService,
    BiDomesticViolenceService,
    BiRecruitsService,
    BiBestPracticesCycleService,
    BiCpcaMeetingService,
    BiGsdEvaluationService,
  ],
  exports: [BiNormalizationService],
})
export class BiModule {}
