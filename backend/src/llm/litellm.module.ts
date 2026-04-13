import { Global, Module } from '@nestjs/common';
import { LitellmService } from './litellm.service';

@Global()
@Module({
  providers: [LitellmService],
  exports: [LitellmService],
})
export class LitellmModule {}
