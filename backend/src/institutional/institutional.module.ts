import { Module } from '@nestjs/common';
import { InstitutionalController } from './institutional.controller';
import { InstitutionalService } from './institutional.service';

@Module({
  controllers: [InstitutionalController],
  providers: [InstitutionalService],
})
export class InstitutionalModule {}
