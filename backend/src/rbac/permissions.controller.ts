import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermission } from './require-permission.decorator';
import { RbacGuard } from './rbac.guard';
import { RbacService } from './rbac.service';

@Controller('permissions')
@UseGuards(JwtAuthGuard, RbacGuard)
export class PermissionsController {
  constructor(private readonly rbac: RbacService) {}

  @Get()
  @RequirePermission('roles', 'view')
  async list() {
    const permissions = await this.rbac.listPermissions();
    return { items: permissions };
  }
}
