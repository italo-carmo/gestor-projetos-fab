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
import { CreateCpcaCaseCipavdThreadDto } from './dto/create-cpca-case-cipavd-thread.dto';
import { CreateCpcaCaseDto } from './dto/create-cpca-case.dto';
import { FinalizeCpcaCaseCipavdThreadDto } from './dto/finalize-cpca-case-cipavd-thread.dto';
import { ReopenCpcaCaseCipavdThreadDto } from './dto/reopen-cpca-case-cipavd-thread.dto';
import { ResolveCpcaCaseCipavdThreadDto } from './dto/resolve-cpca-case-cipavd-thread.dto';
import { UpdateCpcaCaseCipavdThreadDto } from './dto/update-cpca-case-cipavd-thread.dto';
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

  @Get('cipavd-pending-summary')
  @RequirePermission('cpca_cases', 'view')
  cipavdPendingSummary(
    @Query('omId') omId: string | undefined,
    @Query('localityId') localityId: string | undefined,
    @Query('status') status: string | undefined,
    @Query('complaintType') complaintType: string | undefined,
    @Query('detailedViolenceType') detailedViolenceType: string | undefined,
    @Query('procedureType') procedureType: string | undefined,
    @Query('q') q: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpca.pendingSummary(
      {
        localityId: omId ?? localityId,
        status,
        complaintType,
        detailedViolenceType,
        procedureType,
        q,
      },
      user,
    );
  }

  @Get('history')
  @RequirePermission('cpca_cases', 'view')
  history(
    @Query('omId') omId: string | undefined,
    @Query('localityId') localityId: string | undefined,
    @Query('status') status: string | undefined,
    @Query('complaintType') complaintType: string | undefined,
    @Query('detailedViolenceType') detailedViolenceType: string | undefined,
    @Query('procedureType') procedureType: string | undefined,
    @Query('q') q: string | undefined,
    @Query('action') action: string | undefined,
    @Query('actor') actor: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpca.history(
      {
        localityId: omId ?? localityId,
        status,
        complaintType,
        detailedViolenceType,
        procedureType,
        q,
        action,
        actor,
        from,
        to,
        page,
        pageSize,
      },
      user,
    );
  }

  @Get(':id')
  @RequirePermission('cpca_cases', 'view')
  getById(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.cpca.getById(id, user);
  }

  @Post(':id/seen')
  @RequirePermission('cpca_cases', 'view')
  markSeen(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.cpca.markComplaintSeen(id, user);
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

  @Post(':id/cipavd-threads')
  @RequirePermission('cpca_cases', 'view')
  createCipavdThread(
    @Param('id') id: string,
    @Body() dto: CreateCpcaCaseCipavdThreadDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpca.createCipavdThread(id, dto, user);
  }

  @Put(':id/cipavd-threads/:threadId')
  @RequirePermission('cpca_cases', 'view')
  updateCipavdThread(
    @Param('id') id: string,
    @Param('threadId') threadId: string,
    @Body() dto: UpdateCpcaCaseCipavdThreadDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpca.updateCipavdThread(id, threadId, dto, user);
  }

  @Delete(':id/cipavd-threads/:threadId')
  @RequirePermission('cpca_cases', 'view')
  removeCipavdThread(
    @Param('id') id: string,
    @Param('threadId') threadId: string,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpca.removeCipavdThread(id, threadId, user);
  }

  @Post(':id/cipavd-threads/:threadId/resolve')
  @RequirePermission('cpca_cases', 'view')
  resolveCipavdThread(
    @Param('id') id: string,
    @Param('threadId') threadId: string,
    @Body() dto: ResolveCpcaCaseCipavdThreadDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpca.resolveCipavdThread(id, threadId, dto, user);
  }

  @Post(':id/cipavd-threads/:threadId/reopen')
  @RequirePermission('cpca_cases', 'view')
  reopenCipavdThread(
    @Param('id') id: string,
    @Param('threadId') threadId: string,
    @Body() dto: ReopenCpcaCaseCipavdThreadDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpca.reopenCipavdThread(id, threadId, dto, user);
  }

  @Post(':id/cipavd-threads/:threadId/finalize')
  @RequirePermission('cpca_cases', 'view')
  finalizeCipavdThread(
    @Param('id') id: string,
    @Param('threadId') threadId: string,
    @Body() dto: FinalizeCpcaCaseCipavdThreadDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpca.finalizeCipavdThread(id, threadId, dto, user);
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
