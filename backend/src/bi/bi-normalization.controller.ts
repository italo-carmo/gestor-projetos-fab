import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
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

  @Get('review')
  @RequirePermission('bi', 'view')
  review(
    @Query('sourceType') sourceType: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    this.assertCanView(user);
    return this.normalization.review({ sourceType: sourceType ?? null });
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

  @Post('apply')
  @RequirePermission('bi', 'upload')
  apply(
    @Body()
    body: {
      sourceType?: string | null;
      sourceRecordIds?: string[];
      omId?: string | null;
    },
    @CurrentUser() user: RbacUser,
  ) {
    this.assertCanRebuild(user);
    return this.normalization.apply({
      sourceType: body?.sourceType ?? null,
      sourceRecordIds: Array.isArray(body?.sourceRecordIds)
        ? body.sourceRecordIds
        : [],
      omId: body?.omId ?? null,
    });
  }

  @Post('apply-ready')
  @RequirePermission('bi', 'upload')
  applyReady(
    @Body() body: { sourceType?: string | null },
    @CurrentUser() user: RbacUser,
  ) {
    this.assertCanRebuild(user);
    return this.normalization.applyReady({
      sourceType: body?.sourceType ?? null,
    });
  }
}
