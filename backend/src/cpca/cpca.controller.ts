import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { throwError } from '../common/http-error';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import {
  hasAnyRole,
  ROLE_COMANDANTE_COMGEP,
  ROLE_COORDENACAO_CIPAVD,
  ROLE_CPCA,
  ROLE_TI,
} from '../rbac/role-access';
import type { RbacUser } from '../rbac/rbac.types';
import { AddCpcaCaseCommentDto } from './dto/add-cpca-case-comment.dto';
import { CreateCpcaCaseDto } from './dto/create-cpca-case.dto';
import { UpdateCpcaCaseDto } from './dto/update-cpca-case.dto';
import { CpcaService } from './cpca.service';

@Controller('cpca-cases')
@UseGuards(JwtAuthGuard, RbacGuard)
export class CpcaController {
  constructor(private readonly cpca: CpcaService) {}

  @Get()
  @RequirePermission('cpca_cases', 'view')
  list(
    @Query('omId') omId: string | undefined,
    @Query('localityId') localityId: string | undefined,
    @Query('status') status: string | undefined,
    @Query('complaintType') complaintType: string | undefined,
    @Query('detailedViolenceType') detailedViolenceType: string | undefined,
    @Query('procedureType') procedureType: string | undefined,
    @Query('q') q: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    this.assertProcessAccess(user);
    return this.cpca.list(
      {
        localityId: omId ?? localityId,
        status,
        complaintType,
        detailedViolenceType,
        procedureType,
        q,
        page,
        pageSize,
      },
      user,
    );
  }

  @Get('stats')
  @RequirePermission('cpca_cases', 'view')
  stats(
    @Query('omId') omId: string | undefined,
    @Query('localityId') localityId: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    this.assertProcessAccess(user);
    return this.cpca.stats({ localityId: omId ?? localityId, from, to }, user);
  }

  @Get(':id')
  @RequirePermission('cpca_cases', 'view')
  getById(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    this.assertProcessAccess(user);
    return this.cpca.getById(id, user);
  }

  @Post()
  @RequirePermission('cpca_cases', 'create')
  create(@Body() dto: CreateCpcaCaseDto, @CurrentUser() user: RbacUser) {
    this.assertProcessAccess(user);
    return this.cpca.create(dto, user);
  }

  @Put(':id')
  @RequirePermission('cpca_cases', 'update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCpcaCaseDto,
    @CurrentUser() user: RbacUser,
  ) {
    this.assertProcessAccess(user);
    return this.cpca.update(id, dto, user);
  }

  @Get(':id/comments')
  @RequirePermission('cpca_cases', 'view')
  comments(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    this.assertProcessAccess(user);
    return this.cpca.listComments(id, user);
  }

  @Post(':id/comments')
  @RequirePermission('cpca_cases', 'comment')
  addComment(
    @Param('id') id: string,
    @Body() dto: AddCpcaCaseCommentDto,
    @CurrentUser() user: RbacUser,
  ) {
    this.assertProcessAccess(user);
    return this.cpca.addComment(id, dto.text, user);
  }

  private assertProcessAccess(user?: RbacUser) {
    if (
      !hasAnyRole(user, [
        ROLE_CPCA,
        ROLE_COORDENACAO_CIPAVD,
        ROLE_COMANDANTE_COMGEP,
        ROLE_TI,
      ])
    ) {
      throwError('RBAC_FORBIDDEN');
    }
  }
}
