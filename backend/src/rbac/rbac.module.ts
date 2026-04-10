import { Module, forwardRef } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { RbacService } from './rbac.service';
import { RolesController } from './roles.controller';
import { PermissionsController } from './permissions.controller';
import { AdminRbacController } from './admin-rbac.controller';
import { RbacGuard } from './rbac.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DiscoveryModule, forwardRef(() => AuthModule)],
  controllers: [RolesController, PermissionsController, AdminRbacController],
  providers: [RbacService, RbacGuard],
  exports: [RbacService, RbacGuard],
})
export class RbacModule {}
