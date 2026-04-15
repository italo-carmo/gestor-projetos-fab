import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import type { RbacUser } from '../rbac/rbac.types';
import { AddCpcaCaseCommentDto } from './dto/add-cpca-case-comment.dto';
import { CreateCpcaCaseDto } from './dto/create-cpca-case.dto';
import { UpdateCpcaCaseDto } from './dto/update-cpca-case.dto';
import { CpcaService } from './cpca.service';

@Controller('cpca-cases')
@UseGuards(JwtAuthGuard, RbacGuard)
export class CpcaController {
  constructor(private readonly cpca: CpcaService) {}

  @Get('locality-options')
  @RequirePermission('cpca_cases', 'view')
  localityOptions(@CurrentUser() user: RbacUser) {
    return this.cpca.localityOptions(user);
  }

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
  @RequirePermission('cpca_dashboard', 'view')
  stats(
    @Query('omId') omId: string | undefined,
    @Query('localityId') localityId: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpca.stats({ localityId: omId ?? localityId, from, to }, user);
  }

  @Get(':id')
  @RequirePermission('cpca_cases', 'view')
  getById(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.cpca.getById(id, user);
  }

  @Post()
  @RequirePermission('cpca_cases', 'create')
  create(@Body() dto: CreateCpcaCaseDto, @CurrentUser() user: RbacUser) {
    return this.cpca.create(dto, user);
  }

  @Put(':id')
  @RequirePermission('cpca_cases', 'update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCpcaCaseDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpca.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission('cpca_cases', 'delete')
  remove(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.cpca.remove(id, user);
  }

  @Get(':id/comments')
  @RequirePermission('cpca_cases', 'view')
  comments(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.cpca.listComments(id, user);
  }

  @Post(':id/comments')
  @RequirePermission('cpca_cases', 'comment')
  addComment(
    @Param('id') id: string,
    @Body() dto: AddCpcaCaseCommentDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpca.addComment(id, dto.text, user);
  }
}
