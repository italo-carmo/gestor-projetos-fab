import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermission } from './require-permission.decorator';
import { RbacGuard } from './rbac.guard';
import { RbacService } from './rbac.service';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { RbacUser } from './rbac.types';

@Controller('admin/rbac')
@UseGuards(JwtAuthGuard, RbacGuard)
export class AdminRbacController {
  constructor(private readonly rbac: RbacService) {}

  @Get('export')
  @RequirePermission('admin_rbac', 'export')
  export() {
    return this.rbac.exportMatrix();
  }

  @Post('import')
  @RequirePermission('admin_rbac', 'import')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  import(@Body() body: any, @Query('mode') mode?: 'replace' | 'merge', @CurrentUser() user: RbacUser) {
    return this.rbac.importMatrix(body, mode ?? 'replace', user?.id);
  }
}
