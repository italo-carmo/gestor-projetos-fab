import { Global, Module } from '@nestjs/common';
import { FabLdapService } from './fab-ldap.service';

@Global()
@Module({
  providers: [FabLdapService],
  exports: [FabLdapService],
})
export class FabLdapModule {}
