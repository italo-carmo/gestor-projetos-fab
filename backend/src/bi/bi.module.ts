import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { BiBestPracticesCycleController } from './bi-best-practices-cycle.controller';
import { BiBestPracticesCycleService } from './bi-best-practices-cycle.service';
import { BiCpcaMeetingController } from './bi-cpca-meeting.controller';
import { BiCpcaMeetingService } from './bi-cpca-meeting.service';
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
    BiDomesticViolenceController,
    BiRecruitsController,
    BiBestPracticesCycleController,
    BiCpcaMeetingController,
  ],
  providers: [
    BiService,
    BiDomesticViolenceService,
    BiRecruitsService,
    BiBestPracticesCycleService,
    BiCpcaMeetingService,
  ],
})
export class BiModule {}
