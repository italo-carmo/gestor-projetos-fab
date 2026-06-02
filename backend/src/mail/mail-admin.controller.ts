import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { throwError } from '../common/http-error';
import { RbacGuard } from '../rbac/rbac.guard';
import type { RbacUser } from '../rbac/rbac.types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { isTiUser } from '../rbac/role-access';
import { MailService } from './mail.service';

@Controller('admin/email-failures')
@UseGuards(JwtAuthGuard, RbacGuard)
export class MailAdminController {
  constructor(private readonly mail: MailService) {}

  @Get()
  @RequirePermission('admin_rbac', 'update')
  list(
    @CurrentUser() user: RbacUser,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    this.assertTiUser(user);
    return this.mail.listDeliveryFailures({ status, page, pageSize });
  }

  @Post(':id/resolve')
  @RequirePermission('admin_rbac', 'update')
  resolve(@CurrentUser() user: RbacUser, @Param('id') id: string) {
    this.assertTiUser(user);
    return this.mail.resolveDeliveryFailure(id, user.id);
  }

  private assertTiUser(user: RbacUser | undefined) {
    if (!isTiUser(user)) {
      throwError('RBAC_FORBIDDEN');
    }
  }
}
