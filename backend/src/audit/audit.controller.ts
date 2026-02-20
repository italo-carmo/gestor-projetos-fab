import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { throwError } from '../common/http-error';
import { RbacGuard } from '../rbac/rbac.guard';
import { hasAnyRole, ROLE_COORDENACAO_CIPAVD, ROLE_TI } from '../rbac/role-access';
import type { RbacUser } from '../rbac/rbac.types';
import { AuditService } from './audit.service';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RbacGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
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
    if (!hasAnyRole(user, [ROLE_COORDENACAO_CIPAVD, ROLE_TI])) {
      throwError('RBAC_FORBIDDEN');
    }
    return this.audit.list({ resource, userId, localityId, entityId, from, to, page, pageSize });
  }
}
