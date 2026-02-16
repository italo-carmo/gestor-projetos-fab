import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import type { RbacUser } from '../rbac/rbac.types';
import { ElosService } from './elos.service';
import { CreateEloDto } from './dto/create-elo.dto';
import { UpdateEloDto } from './dto/update-elo.dto';

@Controller('elos')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ElosController {
  constructor(private readonly elos: ElosService) {}

  @Get()
  @RequirePermission('elos', 'view')
  list(
    @Query('localityId') localityId: string | undefined,
    @Query('roleType') roleType: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.elos.list({ localityId, roleType, page, pageSize }, user);
  }

  @Post()
  @RequirePermission('elos', 'create')
  create(@Body() dto: CreateEloDto, @CurrentUser() user: RbacUser) {
    return this.elos.create(dto, user);
  }

  @Put(':id')
  @RequirePermission('elos', 'update')
  update(@Param('id') id: string, @Body() dto: UpdateEloDto, @CurrentUser() user: RbacUser) {
    return this.elos.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission('elos', 'delete')
  remove(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.elos.remove(id, user);
  }
}

@Controller('org-chart')
@UseGuards(JwtAuthGuard, RbacGuard)
export class OrgChartController {
  constructor(private readonly elos: ElosService) {}

  @Get()
  @RequirePermission('org_chart', 'view')
  orgChart(
    @Query('localityId') localityId: string | undefined,
    @Query('roleType') roleType: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.elos.orgChart({ localityId, roleType }, user);
  }
}
