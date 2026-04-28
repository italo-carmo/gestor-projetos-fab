import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  Res,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import type { RbacUser } from '../rbac/rbac.types';
import { MissionsService } from './missions.service';
import { CreateMissionDto } from './dto/create-mission.dto';
import { UpdateMissionDto } from './dto/update-mission.dto';
import { CreateMissionScheduleItemDto } from './dto/create-mission-schedule-item.dto';
import { UpdateMissionScheduleItemDto } from './dto/update-mission-schedule-item.dto';
import { UpsertMissionScheduleFieldActivitiesDto } from './dto/upsert-mission-schedule-field-activities.dto';
import { CreateMissionBannerDto } from './dto/create-mission-banner.dto';
import { UpdateMissionBannerDto } from './dto/update-mission-banner.dto';
import { MissionLdapParticipantDto } from './dto/mission-ldap-participant.dto';
import { MissionUserParticipantDto } from './dto/mission-user-participant.dto';
import { UpsertMissionChecklistDto } from './dto/upsert-mission-checklist.dto';
import { CreateMissionChecklistDimensionDto } from './dto/create-mission-checklist-dimension.dto';
import { UpdateMissionChecklistDimensionDto } from './dto/update-mission-checklist-dimension.dto';
import { UpdateMissionChecklistClassificationDto } from './dto/update-mission-checklist-classification.dto';
import type { Response } from 'express';
import { MulterExceptionFilter } from '../reports/multer-exception.filter';
import { throwError } from '../common/http-error';
import {
  getMissionChecklistPhotoCandidates,
  getMissionChecklistPhotosDir,
} from './mission-checklist-storage';

const checklistPhotosDir = getMissionChecklistPhotosDir();
if (!fs.existsSync(checklistPhotosDir)) {
  fs.mkdirSync(checklistPhotosDir, { recursive: true });
}

@Controller('missions')
@UseGuards(JwtAuthGuard, RbacGuard)
export class MissionsController {
  constructor(private readonly missions: MissionsService) {}

  @Get()
  @RequirePermission('missions', 'view')
  list(
    @Query('localityId') localityId: string | undefined,
    @Query('q') q: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @Query('scope') scope: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.list({ localityId, q, page, pageSize, scope }, user);
  }

  @Get('statistics')
  @RequirePermission('missions', 'view')
  getStatistics(
    @Query('scope') scope: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.getStatistics(user, scope);
  }

  @Get('locality-options')
  @RequirePermission('missions', 'view')
  listLocalityOptions(
    @Query('scope') scope: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.listLocalityOptions(scope, user);
  }

  @Get('checklist/mapping')
  @RequirePermission('missions', 'view')
  getChecklistMapping(
    @Query('localityId') localityId: string | undefined,
    @Query('scope') scope: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.getChecklistMapping({ localityId, scope }, user);
  }

  @Get('checklist/config')
  @RequirePermission('missions', 'view')
  getChecklistConfig(@CurrentUser() user: RbacUser) {
    return this.missions.getChecklistConfig(user);
  }

  @Post('checklist/config/dimensions')
  @RequirePermission('missions', 'update')
  createChecklistDimension(
    @Body() dto: CreateMissionChecklistDimensionDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.createChecklistDimension(dto, user);
  }

  @Put('checklist/config/dimensions/:id')
  @RequirePermission('missions', 'update')
  updateChecklistDimension(
    @Param('id') id: string,
    @Body() dto: UpdateMissionChecklistDimensionDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.updateChecklistDimension(id, dto, user);
  }

  @Delete('checklist/config/dimensions/:id')
  @RequirePermission('missions', 'update')
  deleteChecklistDimension(
    @Param('id') id: string,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.deleteChecklistDimension(id, user);
  }

  @Put('checklist/config/classifications/:id')
  @RequirePermission('missions', 'update')
  updateChecklistClassification(
    @Param('id') id: string,
    @Body() dto: UpdateMissionChecklistClassificationDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.updateChecklistClassification(id, dto, user);
  }

  @Post()
  @RequirePermission('missions', 'create')
  create(@Body() dto: CreateMissionDto, @CurrentUser() user: RbacUser) {
    return this.missions.create(dto, user);
  }

  @Put(':id')
  @RequirePermission('missions', 'update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMissionDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission('missions', 'delete')
  remove(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.missions.delete(id, user);
  }

  @Get('ldap-participant')
  @RequirePermission('missions', 'view')
  lookupLdapParticipant(
    @Query('q') q: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.lookupLdapParticipant(q, user);
  }

  @Get(':id')
  @RequirePermission('missions', 'view')
  getById(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.missions.getById(id, user);
  }

  @Get(':id/checklist')
  @RequirePermission('missions', 'view')
  getChecklist(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.missions.getChecklist(id, user);
  }

  @Put(':id/checklist')
  @RequirePermission('missions', 'update')
  upsertChecklist(
    @Param('id') id: string,
    @Body() dto: UpsertMissionChecklistDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.upsertChecklist(id, dto, user);
  }

  @Post(':id/checklist/photos')
  @RequirePermission('missions', 'upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: checklistPhotosDir,
        filename: (_req, file, cb) => {
          const extension = path.extname(file.originalname || '').toLowerCase();
          const safeExtension =
            extension && extension.length <= 10 ? extension : '.jpg';
          cb(null, `${Date.now()}-${randomUUID()}${safeExtension}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const mimetype = String(file.mimetype ?? '').toLowerCase();
        cb(null, mimetype.startsWith('image/'));
      },
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  @UseFilters(MulterExceptionFilter)
  async uploadChecklistPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RbacUser,
  ) {
    if (!file) {
      throwError('VALIDATION_ERROR', { field: 'file', reason: 'required' });
    }
    await this.missions.assertChecklistUploadAccess(id, user);
    return { photoUrl: `/missions/checklist/uploads/${file.filename}` };
  }

  @Post(':id/participants/ldap')
  @RequirePermission('missions', 'update')
  addParticipantFromLdap(
    @Param('id') id: string,
    @Body() dto: MissionLdapParticipantDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.addParticipantFromLdap(id, dto.identifier, user);
  }

  @Post(':id/participants/user')
  @RequirePermission('missions', 'update')
  addParticipantFromUser(
    @Param('id') id: string,
    @Body() dto: MissionUserParticipantDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.addParticipantFromUser(id, dto.userId, user);
  }

  @Delete(':id/participants/:participantId')
  @RequirePermission('missions', 'update')
  removeParticipant(
    @Param('id') id: string,
    @Param('participantId') participantId: string,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.removeParticipant(id, participantId, user);
  }

  @Get(':id/schedule')
  @RequirePermission('missions', 'view')
  listSchedule(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.missions.listSchedule(id, user);
  }

  @Get(':id/banners')
  @RequirePermission('missions', 'view')
  listBanners(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.missions.listBanners(id, user);
  }

  @Post(':id/banners')
  @RequirePermission('missions', 'create')
  createBanner(
    @Param('id') id: string,
    @Body() dto: CreateMissionBannerDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.createBanner(id, dto, user);
  }

  @Put(':id/banners/:bannerId')
  @RequirePermission('missions', 'update')
  updateBanner(
    @Param('id') id: string,
    @Param('bannerId') bannerId: string,
    @Body() dto: UpdateMissionBannerDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.updateBanner(id, bannerId, dto, user);
  }

  @Delete(':id/banners/:bannerId')
  @RequirePermission('missions', 'delete')
  deleteBanner(
    @Param('id') id: string,
    @Param('bannerId') bannerId: string,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.deleteBanner(id, bannerId, user);
  }

  @Get(':id/banners/:bannerId/preview')
  @RequirePermission('missions', 'view')
  async previewBanner(
    @Param('id') id: string,
    @Param('bannerId') bannerId: string,
    @CurrentUser() user: RbacUser,
    @Res() res: Response,
  ) {
    const buffer = await this.missions.buildBannerPng(id, bannerId, user);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=60');
    return res.send(buffer);
  }

  @Get(':id/banners/:bannerId/file')
  @RequirePermission('missions', 'download')
  async downloadBannerFile(
    @Param('id') id: string,
    @Param('bannerId') bannerId: string,
    @Query('format') format: string | undefined,
    @CurrentUser() user: RbacUser,
    @Res() res: Response,
  ) {
    const file = await this.missions.buildBannerDownload(
      id,
      bannerId,
      format,
      user,
    );
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    return res.send(file.buffer);
  }

  @Post(':id/schedule')
  @RequirePermission('missions', 'create')
  createScheduleItem(
    @Param('id') id: string,
    @Body() dto: CreateMissionScheduleItemDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.createScheduleItem(id, dto, user);
  }

  @Put(':id/schedule/:itemId')
  @RequirePermission('missions', 'update')
  updateScheduleItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateMissionScheduleItemDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.updateScheduleItem(id, itemId, dto, user);
  }

  @Post(':id/schedule/field-activities')
  @RequirePermission('missions', 'update')
  upsertScheduleFieldActivities(
    @Param('id') id: string,
    @Body() dto: UpsertMissionScheduleFieldActivitiesDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.upsertScheduleFieldActivities(id, dto, user);
  }

  @Delete(':id/schedule/:itemId')
  @RequirePermission('missions', 'delete')
  deleteScheduleItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: RbacUser,
  ) {
    return this.missions.deleteScheduleItem(id, itemId, user);
  }

  @Get(':id/schedule/pdf')
  @RequirePermission('missions', 'download')
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

@Controller('missions/checklist/uploads')
export class MissionsChecklistUploadsController {
  @Get(':filename')
  async uploadedPhoto(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const safeName = path.basename(String(filename ?? ''));
    if (!safeName || safeName !== filename) throwError('NOT_FOUND');
    const filePath = getMissionChecklistPhotoCandidates(safeName).find(
      (candidate) => fs.existsSync(candidate),
    );
    if (!filePath) throwError('NOT_FOUND');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.sendFile(filePath);
  }
}
