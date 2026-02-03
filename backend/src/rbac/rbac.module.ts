import { Module } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { RolesController } from './roles.controller';
import { PermissionsController } from './permissions.controller';
import { AdminRbacController } from './admin-rbac.controller';
import { RbacGuard } from './rbac.guard';

@Module({
  controllers: [RolesController, PermissionsController, AdminRbacController],
  providers: [RbacService, RbacGuard],
  exports: [RbacService, RbacGuard],
})
export class RbacModule {}
