import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InstitutionalController } from './institutional.controller';
import { InstitutionalService } from './institutional.service';

@Module({
  imports: [AuthModule],
  controllers: [InstitutionalController],
  providers: [InstitutionalService],
})
export class InstitutionalModule {}
