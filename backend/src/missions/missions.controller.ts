import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import type { RbacUser } from '../rbac/rbac.types';
import { MissionsService } from './missions.service';
import { CreateMissionDto } from './dto/create-mission.dto';
import { UpdateMissionDto } from './dto/update-mission.dto';
import { CreateMissionScheduleItemDto } from './dto/create-mission-schedule-item.dto';
import { UpdateMissionScheduleItemDto } from './dto/update-mission-schedule-item.dto';
import { MissionLdapParticipantDto } from './dto/mission-ldap-participant.dto';
import { MissionUserParticipantDto } from './dto/mission-user-participant.dto';
import { UpsertMissionChecklistDto } from './dto/upsert-mission-checklist.dto';
import { CreateMissionChecklistDimensionDto } from './dto/create-mission-checklist-dimension.dto';
import { UpdateMissionChecklistDimensionDto } from './dto/update-mission-checklist-dimension.dto';
import { UpdateMissionChecklistClassificationDto } from './dto/update-mission-checklist-classification.dto';
import type { Response } from 'express';

@Controller('missions')
@UseGuards(JwtAuthGuard, RbacGuard)
export class MissionsController {
  constructor(private readonly missions: MissionsService) {}

  @Get()
  list(
    @Query('localityId') localityId: string | undefined,
    @Query('q') q: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.list({ localityId, q, page, pageSize }, user);
  }

  @Get('statistics')
  getStatistics(@CurrentUser() user: RbacUser) {
    return this.missions.getStatistics(user);
  }

  @Get('checklist/mapping')
  getChecklistMapping(
    @Query('localityId') localityId: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.getChecklistMapping({ localityId }, user);
  }

  @Get('checklist/config')
  getChecklistConfig(@CurrentUser() user: RbacUser) {
    return this.missions.getChecklistConfig(user);
  }

  @Post('checklist/config/dimensions')
  createChecklistDimension(
    @Body() dto: CreateMissionChecklistDimensionDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.createChecklistDimension(dto, user);
  }

  @Put('checklist/config/dimensions/:id')
  updateChecklistDimension(
    @Param('id') id: string,
    @Body() dto: UpdateMissionChecklistDimensionDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.updateChecklistDimension(id, dto, user);
  }

  @Delete('checklist/config/dimensions/:id')
  deleteChecklistDimension(
    @Param('id') id: string,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.deleteChecklistDimension(id, user);
  }

  @Put('checklist/config/classifications/:id')
  updateChecklistClassification(
    @Param('id') id: string,
    @Body() dto: UpdateMissionChecklistClassificationDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.updateChecklistClassification(id, dto, user);
  }

  @Post()
  create(@Body() dto: CreateMissionDto, @CurrentUser() user: RbacUser) {
    return this.missions.create(dto, user);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMissionDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.missions.delete(id, user);
  }

  @Get('ldap-participant')
  lookupLdapParticipant(
    @Query('q') q: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.lookupLdapParticipant(q, user);
  }

  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.missions.getById(id, user);
  }

  @Get(':id/checklist')
  getChecklist(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.missions.getChecklist(id, user);
  }

  @Put(':id/checklist')
  upsertChecklist(
    @Param('id') id: string,
    @Body() dto: UpsertMissionChecklistDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.upsertChecklist(id, dto, user);
  }

  @Post(':id/participants/ldap')
  addParticipantFromLdap(
    @Param('id') id: string,
    @Body() dto: MissionLdapParticipantDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.addParticipantFromLdap(id, dto.identifier, user);
  }

  @Post(':id/participants/user')
  addParticipantFromUser(
    @Param('id') id: string,
    @Body() dto: MissionUserParticipantDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.addParticipantFromUser(id, dto.userId, user);
  }

  @Delete(':id/participants/:participantId')
  removeParticipant(
    @Param('id') id: string,
    @Param('participantId') participantId: string,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.removeParticipant(id, participantId, user);
  }

  @Get(':id/schedule')
  listSchedule(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.missions.listSchedule(id, user);
  }

  @Post(':id/schedule')
  createScheduleItem(
    @Param('id') id: string,
    @Body() dto: CreateMissionScheduleItemDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.createScheduleItem(id, dto, user);
  }

  @Put(':id/schedule/:itemId')
  updateScheduleItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateMissionScheduleItemDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.updateScheduleItem(id, itemId, dto, user);
  }

  @Delete(':id/schedule/:itemId')
  deleteScheduleItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.deleteScheduleItem(id, itemId, user);
  }

  @Get(':id/schedule/pdf')
  async exportSchedulePdf(
    @Param('id') id: string,
    @CurrentUser() user: RbacUser,
    @Res() res: Response,
  ) {
    const { fileName, buffer } = await this.missions.buildSchedulePdf(id, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(buffer);
  }
}
