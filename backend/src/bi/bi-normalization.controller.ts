import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { throwError } from '../common/http-error';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { hasAnyRole, ROLE_COMGEP, ROLE_TI } from '../rbac/role-access';
import type { RbacUser } from '../rbac/rbac.types';
import { BiNormalizationService } from './bi-normalization.service';

@Controller('bi/normalization')
@UseGuards(JwtAuthGuard, RbacGuard)
export class BiNormalizationController {
  constructor(private readonly normalization: BiNormalizationService) {}

  private assertCanView(user: RbacUser) {
    if (!hasAnyRole(user, [ROLE_TI, ROLE_COMGEP])) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  private assertCanRebuild(user: RbacUser) {
    if (!hasAnyRole(user, [ROLE_TI])) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  @Get('overview')
  @RequirePermission('bi', 'view')
  overview(@CurrentUser() user: RbacUser) {
    this.assertCanView(user);
    return this.normalization.overview();
  }

  @Post('rebuild')
  @RequirePermission('bi', 'upload')
  rebuild(
    @Body() body: { sourceType?: string | null },
    @CurrentUser() user: RbacUser,
  ) {
    this.assertCanRebuild(user);
    return this.normalization.rebuild({ sourceType: body?.sourceType ?? null });
  }
}
