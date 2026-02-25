import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { SocialCommunicationController } from './social-communication.controller';
import { SocialCommunicationService } from './social-communication.service';

@Module({
  imports: [RbacModule],
  controllers: [SocialCommunicationController],
  providers: [SocialCommunicationService],
})
export class SocialCommunicationModule {}
