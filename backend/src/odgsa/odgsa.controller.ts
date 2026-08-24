import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { PermissionScope } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { throwError } from '../common/http-error';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { isTiUser } from '../rbac/role-access';
import type { RbacUser } from '../rbac/rbac.types';
import { CreateOdgsaDto } from './dto/create-odgsa.dto';
import { UpdateOdgsaOmsBatchDto } from './dto/update-odgsa-oms-batch.dto';
import { UpdateOdgsaDto } from './dto/update-odgsa.dto';
import { OdgsaService } from './odgsa.service';

@Controller('odgsas')
@UseGuards(JwtAuthGuard, RbacGuard)
export class OdgsaController {
  constructor(private readonly odgsas: OdgsaService) {}

  @Get('mine')
  @RequirePermission('odgsa_oms', 'view', PermissionScope.LOCALITY)
  mine(@CurrentUser() user: RbacUser) {
    return this.odgsas.getMine(user);
  }

  @Get('mine/oms')
  @RequirePermission('odgsa_oms', 'view', PermissionScope.LOCALITY)
  mineOms(@CurrentUser() user: RbacUser) {
    return this.odgsas.listMineOms(user);
  }

  @Put('mine/oms/batch')
  @RequirePermission('odgsa_oms', 'update', PermissionScope.LOCALITY)
  updateMineOms(
    @Body() dto: UpdateOdgsaOmsBatchDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.odgsas.updateMineOms(user, dto);
  }

  @Get()
  @RequirePermission('odgsa_admin', 'view', PermissionScope.NATIONAL)
  list(@CurrentUser() user: RbacUser) {
    this.assertTi(user);
    return this.odgsas.listAdmin();
  }

  @Post()
  @RequirePermission('odgsa_admin', 'create', PermissionScope.NATIONAL)
  create(@Body() dto: CreateOdgsaDto, @CurrentUser() user: RbacUser) {
    this.assertTi(user);
    return this.odgsas.create(dto, user.id);
  }

  @Put(':id')
  @RequirePermission('odgsa_admin', 'update', PermissionScope.NATIONAL)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOdgsaDto,
    @CurrentUser() user: RbacUser,
  ) {
    this.assertTi(user);
    return this.odgsas.update(id, dto, user.id);
  }

  private assertTi(user: RbacUser) {
    if (!isTiUser(user)) throwError('RBAC_FORBIDDEN');
  }
}
