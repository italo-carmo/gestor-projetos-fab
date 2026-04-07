import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import type { RbacUser } from '../rbac/rbac.types';
import { AuditService } from './audit.service';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RbacGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('last-logins')
  @RequirePermission('audit_logs', 'view')
  lastLogins(@CurrentUser() user: RbacUser) {
    void user;
    return this.audit.lastLoginsByUser();
  }

  @Get()
  @RequirePermission('audit_logs', 'view')
  list(
    @Query('resource') resource: string | undefined,
    @Query('userId') userId: string | undefined,
    @Query('localityId') localityId: string | undefined,
    @Query('entityId') entityId: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    void user;
    return this.audit.list({
      resource,
      userId,
      localityId,
      entityId,
      from,
      to,
      page,
      pageSize,
    });
  }
}
