import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermission } from './require-permission.decorator';
import { RbacGuard } from './rbac.guard';
import { RbacService } from './rbac.service';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { RbacUser } from './rbac.types';
import { SetUserModuleAccessDto } from './dto/set-user-module-access.dto';
import { LookupLdapUserDto } from './dto/lookup-ldap-user.dto';
import { UpsertLdapUserDto } from './dto/upsert-ldap-user.dto';

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
  import(@Body() body: any, @CurrentUser() user: RbacUser, @Query('mode') mode?: 'replace' | 'merge') {
    return this.rbac.importMatrix(body, mode ?? 'replace', user?.id);
  }

  @Get('simulate')
  @RequirePermission('admin_rbac', 'export')
  simulate(@Query('userId') userId?: string, @Query('roleId') roleId?: string) {
    return this.rbac.simulateAccess({ userId, roleId });
  }

  @Get('user-module-access/:userId')
  @RequirePermission('users', 'view')
  userModuleAccess(@Param('userId') userId: string) {
    return this.rbac.getUserModuleAccess(userId);
  }

  @Put('user-module-access/:userId')
  @RequirePermission('users', 'update')
  setUserModuleAccess(
    @Param('userId') userId: string,
    @Body() dto: SetUserModuleAccessDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.rbac.setUserModuleAccess(
      userId,
      { resource: dto.resource, enabled: dto.enabled },
      user?.id,
    );
  }

  @Get('ldap-user')
  @RequirePermission('users', 'view')
  lookupLdapUser(@Query() query: LookupLdapUserDto) {
    return this.rbac.lookupLdapUser(query.uid);
  }

  @Post('ldap-user')
  @RequirePermission('users', 'update')
  upsertLdapUser(
    @Body() dto: UpsertLdapUserDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.rbac.upsertLdapUser(
      {
        uid: dto.uid,
        roleId: dto.roleId,
        localityId: dto.localityId,
        specialtyId: dto.specialtyId,
        eloRoleId: dto.eloRoleId,
        replaceExistingRoles: dto.replaceExistingRoles ?? false,
      },
      user?.id,
    );
  }
}
