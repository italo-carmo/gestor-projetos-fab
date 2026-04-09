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
import { CreateCpcaCaseDto } from '../cpca/dto/create-cpca-case.dto';
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

  @Get(':id')
  @RequirePermission('smif_complaints', 'view')
  getById(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.smifComplaints.getById(id, user);
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
