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
import { AddCpcaCaseCommentDto } from '../cpca/dto/add-cpca-case-comment.dto';
import { CreateCpcaCaseCipavdThreadDto } from '../cpca/dto/create-cpca-case-cipavd-thread.dto';
import { CreateCpcaCaseDto } from '../cpca/dto/create-cpca-case.dto';
import { FinalizeCpcaCaseCipavdThreadDto } from '../cpca/dto/finalize-cpca-case-cipavd-thread.dto';
import { ReopenCpcaCaseCipavdThreadDto } from '../cpca/dto/reopen-cpca-case-cipavd-thread.dto';
import { ResolveCpcaCaseCipavdThreadDto } from '../cpca/dto/resolve-cpca-case-cipavd-thread.dto';
import { UpdateCpcaCaseCipavdThreadDto } from '../cpca/dto/update-cpca-case-cipavd-thread.dto';
import { UpdateCpcaCaseDto } from '../cpca/dto/update-cpca-case.dto';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import type { RbacUser } from '../rbac/rbac.types';
import { SmifComplaintsService } from './smif-complaints.service';

@Controller('smif-complaints')
@UseGuards(JwtAuthGuard, RbacGuard)
export class SmifComplaintsController {
  constructor(private readonly smifComplaints: SmifComplaintsService) {}

  @Get()
  @RequirePermission('smif_complaints', 'view')
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
    return this.smifComplaints.list(
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

  @Get('cipavd-pending-summary')
  @RequirePermission('smif_complaints', 'view')
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
    return this.smifComplaints.pendingSummary(
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

  @Get('procedure-summary')
  @RequirePermission('smif_complaints', 'view')
  procedureSummary(
    @Query('omId') omId: string | undefined,
    @Query('localityId') localityId: string | undefined,
    @Query('status') status: string | undefined,
    @Query('complaintType') complaintType: string | undefined,
    @Query('detailedViolenceType') detailedViolenceType: string | undefined,
    @Query('procedureType') procedureType: string | undefined,
    @Query('q') q: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.smifComplaints.procedureSummary(
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

  @Get(':id')
  @RequirePermission('smif_complaints', 'view')
  getById(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.smifComplaints.getById(id, user);
  }

  @Post(':id/seen')
  @RequirePermission('smif_complaints', 'view')
  markSeen(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.smifComplaints.markSeen(id, user);
  }

  @Post()
  @RequirePermission('smif_complaints', 'create')
  create(@Body() dto: CreateCpcaCaseDto, @CurrentUser() user: RbacUser) {
    return this.smifComplaints.create(dto, user);
  }

  @Put(':id')
  @RequirePermission('smif_complaints', 'update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCpcaCaseDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.smifComplaints.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission('smif_complaints', 'delete')
  remove(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.smifComplaints.remove(id, user);
  }

  @Post(':id/cipavd-threads')
  @RequirePermission('smif_complaints', 'view')
  createCipavdThread(
    @Param('id') id: string,
    @Body() dto: CreateCpcaCaseCipavdThreadDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.smifComplaints.createCipavdThread(id, dto, user);
  }

  @Put(':id/cipavd-threads/:threadId')
  @RequirePermission('smif_complaints', 'view')
  updateCipavdThread(
    @Param('id') id: string,
    @Param('threadId') threadId: string,
    @Body() dto: UpdateCpcaCaseCipavdThreadDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.smifComplaints.updateCipavdThread(id, threadId, dto, user);
  }

  @Delete(':id/cipavd-threads/:threadId')
  @RequirePermission('smif_complaints', 'view')
  removeCipavdThread(
    @Param('id') id: string,
    @Param('threadId') threadId: string,
    @CurrentUser() user: RbacUser,
  ) {
    return this.smifComplaints.removeCipavdThread(id, threadId, user);
  }

  @Post(':id/cipavd-threads/:threadId/resolve')
  @RequirePermission('smif_complaints', 'view')
  resolveCipavdThread(
    @Param('id') id: string,
    @Param('threadId') threadId: string,
    @Body() dto: ResolveCpcaCaseCipavdThreadDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.smifComplaints.resolveCipavdThread(id, threadId, dto, user);
  }

  @Post(':id/cipavd-threads/:threadId/reopen')
  @RequirePermission('smif_complaints', 'view')
  reopenCipavdThread(
    @Param('id') id: string,
    @Param('threadId') threadId: string,
    @Body() dto: ReopenCpcaCaseCipavdThreadDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.smifComplaints.reopenCipavdThread(id, threadId, dto, user);
  }

  @Post(':id/cipavd-threads/:threadId/finalize')
  @RequirePermission('smif_complaints', 'view')
  finalizeCipavdThread(
    @Param('id') id: string,
    @Param('threadId') threadId: string,
    @Body() dto: FinalizeCpcaCaseCipavdThreadDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.smifComplaints.finalizeCipavdThread(id, threadId, dto, user);
  }

  @Get(':id/comments')
  @RequirePermission('smif_complaints', 'view')
  comments(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.smifComplaints.listComments(id, user);
  }

  @Post(':id/comments')
  @RequirePermission('smif_complaints', 'comment')
  addComment(
    @Param('id') id: string,
    @Body() dto: AddCpcaCaseCommentDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.smifComplaints.addComment(id, dto, user);
  }
}
