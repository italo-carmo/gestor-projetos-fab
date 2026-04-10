import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { RbacService } from './rbac.service';
import { RolesController } from './roles.controller';
import { PermissionsController } from './permissions.controller';
import { AdminRbacController } from './admin-rbac.controller';
import { RbacGuard } from './rbac.guard';

@Module({
  imports: [DiscoveryModule],
  controllers: [RolesController, PermissionsController, AdminRbacController],
  providers: [RbacService, RbacGuard],
  exports: [RbacService, RbacGuard],
})
export class RbacModule {}
