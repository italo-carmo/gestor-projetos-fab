import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RbacUser } from '../rbac/rbac.types';
import { CreateChecklistDto } from './dto/create-checklist.dto';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { UpdateChecklistStatusDto } from './dto/update-checklist-status.dto';
import { ChecklistsService } from './checklists.service';

@Controller('checklists')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ChecklistsController {
  constructor(private readonly checklists: ChecklistsService) {}

  @Get()
  @RequirePermission('checklists', 'view')
  list(
    @Query('phaseId') phaseId: string | undefined,
    @Query('specialtyId') specialtyId: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.checklists.list({ phaseId, specialtyId }, user);
  }

  @Post()
  @RequirePermission('checklists', 'create')
  create(@Body() dto: CreateChecklistDto, @CurrentUser() user: RbacUser) {
    return this.checklists.create(dto, user);
  }

  @Post(':id/items')
  @RequirePermission('checklists', 'update')
  addItem(@Param('id') id: string, @Body() dto: CreateChecklistItemDto, @CurrentUser() user: RbacUser) {
    return this.checklists.addItem(id, dto, user);
  }
}

@Controller('checklist-item-status')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ChecklistItemStatusController {
  constructor(private readonly checklists: ChecklistsService) {}

  @Put('batch')
  @RequirePermission('checklists', 'update')
  batch(@Body() dto: UpdateChecklistStatusDto, @CurrentUser() user: RbacUser) {
    return this.checklists.updateStatuses(dto.updates, user);
  }
}

