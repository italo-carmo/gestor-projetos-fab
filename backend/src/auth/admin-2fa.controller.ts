import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { AuthService } from './auth.service';

@Controller('admin/rbac')
@UseGuards(JwtAuthGuard, RbacGuard)
export class Admin2faController {
  constructor(private readonly auth: AuthService) {}

  @Post('users/:id/reset-2fa')
  @RequirePermission('users', 'update')
  resetTwoFactor(@Param('id') id: string) {
    return this.auth.resetTwoFactor(id);
  }

  @Get('users/:id/2fa-status')
  @RequirePermission('users', 'view')
  twoFactorStatus(@Param('id') id: string) {
    return this.auth.getUserTwoFactorStatus(id);
  }
}
