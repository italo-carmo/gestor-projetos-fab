import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import type { RbacUser } from '../rbac/rbac.types';
import { UpdateCpcaChecklistDto } from './dto/update-cpca-checklist.dto';
import { CpcaChecklistService } from './cpca-checklist.service';

@Controller('cpca-checklist')
export class CpcaChecklistController {
  constructor(private readonly cpcaChecklist: CpcaChecklistService) {}

  @Get('locality')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('cpca_cases', 'view')
  getLocalityChecklist(
    @Query('localityId') localityId: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpcaChecklist.getLocalityChecklist(user, localityId);
  }

  @Put('locality')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('cpca_cases', 'update')
  updateLocalityChecklist(
    @Body() dto: UpdateCpcaChecklistDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpcaChecklist.updateLocalityChecklist(
      {
        localityId: dto.localityId,
        items: dto.items,
      },
      user,
    );
  }

  @Get('national')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('cpca_checklist', 'view', 'NATIONAL')
  listNationalChecklist(
    @Query('q') q: string | undefined,
    @Query('uf') uf: string | undefined,
    @Query('status') status: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpcaChecklist.listNationalChecklistOverview(user, {
      q,
      uf,
      status,
    });
  }
}
