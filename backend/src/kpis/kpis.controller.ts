import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import type { RbacUser } from '../rbac/rbac.types';
import { CreateKpiDto } from './dto/create-kpi.dto';
import { CreateKpiValueDto } from './dto/create-kpi-value.dto';
import { KpisService } from './kpis.service';

@Controller('kpis')
@UseGuards(JwtAuthGuard, RbacGuard)
export class KpisController {
  constructor(private readonly kpis: KpisService) {}

  @Get()
  @RequirePermission('kpis', 'view')
  list(@CurrentUser() user: RbacUser) {
    return this.kpis.list(user);
  }

  @Post()
  @RequirePermission('kpis', 'create')
  create(@Body() dto: CreateKpiDto) {
    return this.kpis.create(dto);
  }

  @Post(':id/values')
  @RequirePermission('kpis', 'create')
  addValue(@Param('id') id: string, @Body() dto: CreateKpiValueDto) {
    return this.kpis.addValue(id, dto);
  }

  @Get('dashboard')
  @RequirePermission('kpis', 'view')
  dashboard(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.kpis.dashboard({ from, to }, user);
  }
}

