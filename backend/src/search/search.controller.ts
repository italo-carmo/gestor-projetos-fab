import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { RbacUser } from '../rbac/rbac.types';
import { SearchService } from './search.service';

@Controller('search')
@UseGuards(JwtAuthGuard, RbacGuard)
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @RequirePermission('search', 'view')
  query(@Query('q') q: string, @CurrentUser() user: RbacUser) {
    return this.search.query(q, user);
  }
}

