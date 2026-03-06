import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import type { RbacUser } from '../rbac/rbac.types';
import { BestPracticesService } from './best-practices.service';
import { CreateBestPracticeDto } from './dto/create-best-practice.dto';
import { ListBestPracticeDto } from './dto/list-best-practice.dto';
import { UpdateBestPracticeDto } from './dto/update-best-practice.dto';

@Controller('best-practices')
@UseGuards(JwtAuthGuard, RbacGuard)
export class BestPracticesController {
  constructor(private readonly bestPractices: BestPracticesService) {}

  @Get()
  @RequirePermission('best_practices', 'view')
  list(@Query() query: ListBestPracticeDto, @CurrentUser() user: RbacUser) {
    return this.bestPractices.list(query, user);
  }

  @Post()
  @RequirePermission('best_practices', 'create')
  create(@Body() dto: CreateBestPracticeDto, @CurrentUser() user: RbacUser) {
    return this.bestPractices.create(dto, user);
  }

  @Put(':id')
  @RequirePermission('best_practices', 'update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBestPracticeDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.bestPractices.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission('best_practices', 'delete')
  remove(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.bestPractices.remove(id, user);
  }
}


