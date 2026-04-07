import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import type { RbacUser } from '../rbac/rbac.types';
import { MenuUpdatesService } from './menu-updates.service';

@Controller('menu-updates')
@UseGuards(JwtAuthGuard, RbacGuard)
export class MenuUpdatesController {
  constructor(private readonly menuUpdates: MenuUpdatesService) {}

  @Get()
  list(
    @Query('menuKeys') menuKeys: string | string[] | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.menuUpdates.list(menuKeys, user);
  }

  @Post(':menuKey/seen')
  markSeen(@Param('menuKey') menuKey: string, @CurrentUser() user: RbacUser) {
    return this.menuUpdates.markSeen(menuKey, user);
  }
}
