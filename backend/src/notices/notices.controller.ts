import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RbacUser } from '../rbac/rbac.types';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';
import { PinNoticeDto } from './dto/pin-notice.dto';
import { NoticesService } from './notices.service';

@Controller('notices')
@UseGuards(JwtAuthGuard, RbacGuard)
export class NoticesController {
  constructor(private readonly notices: NoticesService) {}

  @Get()
  @RequirePermission('notices', 'view')
  list(
    @Query('localityId') localityId: string | undefined,
    @Query('specialtyId') specialtyId: string | undefined,
    @Query('pinned') pinned: string | undefined,
    @Query('priority') priority: string | undefined,
    @Query('dueFrom') dueFrom: string | undefined,
    @Query('dueTo') dueTo: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.notices.list(
      { localityId, specialtyId, pinned, priority, dueFrom, dueTo, page, pageSize },
      user,
    );
  }

  @Post()
  @RequirePermission('notices', 'create')
  create(@Body() dto: CreateNoticeDto, @CurrentUser() user: RbacUser) {
    return this.notices.create(dto, user);
  }

  @Put(':id')
  @RequirePermission('notices', 'update')
  update(@Param('id') id: string, @Body() dto: UpdateNoticeDto, @CurrentUser() user: RbacUser) {
    return this.notices.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission('notices', 'delete')
  remove(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.notices.remove(id, user);
  }

  @Patch(':id/pin')
  @RequirePermission('notices', 'pin')
  pin(@Param('id') id: string, @Body() dto: PinNoticeDto, @CurrentUser() user: RbacUser) {
    return this.notices.pin(id, dto.pinned, user);
  }
}

