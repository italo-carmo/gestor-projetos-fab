import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import type { RbacUser } from '../rbac/rbac.types';
import { CreateLessonLearnedDto } from './dto/create-lesson-learned.dto';
import { CreateLessonLearnedTypeDto } from './dto/create-lesson-learned-type.dto';
import { ListLessonLearnedDto } from './dto/list-lesson-learned.dto';
import { UpdateLessonLearnedDto } from './dto/update-lesson-learned.dto';
import { UpdateLessonLearnedTypeDto } from './dto/update-lesson-learned-type.dto';
import { LessonsLearnedService } from './lessons-learned.service';

@Controller('lessons-learned')
@UseGuards(JwtAuthGuard, RbacGuard)
export class LessonsLearnedController {
  constructor(private readonly lessons: LessonsLearnedService) {}

  @Get()
  @RequirePermission('lessons_learned', 'view')
  list(@Query() query: ListLessonLearnedDto, @CurrentUser() user: RbacUser) {
    return this.lessons.list(query, user);
  }

  @Get('types')
  @RequirePermission('lessons_learned', 'view')
  listTypes(@CurrentUser() user: RbacUser) {
    return this.lessons.listTypes(user);
  }

  @Post()
  @RequirePermission('lessons_learned', 'create')
  create(@Body() dto: CreateLessonLearnedDto, @CurrentUser() user: RbacUser) {
    return this.lessons.create(dto, user);
  }

  @Post('types')
  @RequirePermission('lessons_learned', 'create')
  createType(@Body() dto: CreateLessonLearnedTypeDto, @CurrentUser() user: RbacUser) {
    return this.lessons.createType(dto, user);
  }

  @Put(':id')
  @RequirePermission('lessons_learned', 'update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLessonLearnedDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.lessons.update(id, dto, user);
  }

  @Put('types/:id')
  @RequirePermission('lessons_learned', 'update')
  updateType(
    @Param('id') id: string,
    @Body() dto: UpdateLessonLearnedTypeDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.lessons.updateType(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission('lessons_learned', 'delete')
  remove(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.lessons.remove(id, user);
  }

  @Delete('types/:id')
  @RequirePermission('lessons_learned', 'delete')
  removeType(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.lessons.removeType(id, user);
  }
}


