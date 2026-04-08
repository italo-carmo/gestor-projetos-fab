import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { BiDomesticViolenceController } from './bi-domestic-violence.controller';
import { BiDomesticViolenceService } from './bi-domestic-violence.service';
import { BiRecruitsController } from './bi-recruits.controller';
import { BiRecruitsService } from './bi-recruits.service';
import { BiController } from './bi.controller';
import { BiService } from './bi.service';

@Module({
  imports: [RbacModule],
  controllers: [BiController, BiDomesticViolenceController, BiRecruitsController],
  providers: [BiService, BiDomesticViolenceService, BiRecruitsService],
})
export class BiModule {}
