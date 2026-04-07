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
import { CreateSmifComplaintDto } from './dto/create-smif-complaint.dto';
import { ListSmifComplaintDto } from './dto/list-smif-complaint.dto';
import { UpdateSmifComplaintDto } from './dto/update-smif-complaint.dto';
import { SmifComplaintsService } from './smif-complaints.service';

@Controller('smif-complaints')
@UseGuards(JwtAuthGuard, RbacGuard)
export class SmifComplaintsController {
  constructor(private readonly smifComplaints: SmifComplaintsService) {}

  @Get()
  @RequirePermission('smif_complaints', 'view')
  list(@Query() query: ListSmifComplaintDto, @CurrentUser() user: RbacUser) {
    return this.smifComplaints.list(query, user);
  }

  @Post()
  @RequirePermission('smif_complaints', 'create')
  create(@Body() dto: CreateSmifComplaintDto, @CurrentUser() user: RbacUser) {
    return this.smifComplaints.create(dto, user);
  }

  @Put(':id')
  @RequirePermission('smif_complaints', 'update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSmifComplaintDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.smifComplaints.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission('smif_complaints', 'delete')
  remove(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.smifComplaints.remove(id, user);
  }
}
