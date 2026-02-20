import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { throwError } from '../common/http-error';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import type { RbacUser } from '../rbac/rbac.types';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { UpdateActivityStatusDto } from './dto/update-activity-status.dto';
import { UpsertActivityReportDto } from './dto/upsert-activity-report.dto';
import { ActivityCommentDto } from './dto/activity-comment.dto';
import { CreateActivityScheduleItemDto } from './dto/create-activity-schedule-item.dto';
import { UpdateActivityScheduleItemDto } from './dto/update-activity-schedule-item.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { MulterExceptionFilter } from '../reports/multer-exception.filter';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import type { Request, Response } from 'express';

const uploadDir = path.resolve(process.cwd(), 'storage', 'activity-reports');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

@Controller('activities')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @Get()
  @RequirePermission('task_instances', 'view')
  list(
    @Query('localityId') localityId: string | undefined,
    @Query('specialtyId') specialtyId: string | undefined,
    @Query('status') status: string | undefined,
    @Query('q') q: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.activities.list({ localityId, specialtyId, status, q, page, pageSize }, user);
  }

  @Post()
  @RequirePermission('task_instances', 'create')
  create(@Body() dto: CreateActivityDto, @CurrentUser() user: RbacUser) {
    return this.activities.create(dto, user);
  }

  @Put(':id')
  @RequirePermission('task_instances', 'update')
  update(@Param('id') id: string, @Body() dto: UpdateActivityDto, @CurrentUser() user: RbacUser) {
    return this.activities.update(id, dto, user);
  }

  @Put(':id/status')
  @RequirePermission('task_instances', 'update')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateActivityStatusDto, @CurrentUser() user: RbacUser) {
    return this.activities.updateStatus(id, dto.status as any, user);
  }

  @Delete(':id')
  @RequirePermission('task_instances', 'update')
  remove(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.activities.delete(id, user);
  }

  @Get(':id/comments')
  @RequirePermission('task_instances', 'view')
  comments(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.activities.listComments(id, user);
  }

  @Post(':id/comments')
  @RequirePermission('task_instances', 'update')
  addComment(@Param('id') id: string, @Body() dto: ActivityCommentDto, @CurrentUser() user: RbacUser) {
    return this.activities.addComment(id, dto.text, user);
  }

  @Post(':id/comments/seen')
  @RequirePermission('task_instances', 'view')
  markCommentsSeen(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.activities.markCommentsSeen(id, user);
  }

  @Get(':id/schedule')
  @RequirePermission('task_instances', 'view')
  listSchedule(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.activities.listSchedule(id, user);
  }

  @Post(':id/schedule')
  @RequirePermission('task_instances', 'update')
  createScheduleItem(
    @Param('id') id: string,
    @Body() dto: CreateActivityScheduleItemDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.activities.createScheduleItem(id, dto, user);
  }

  @Put(':id/schedule/:itemId')
  @RequirePermission('task_instances', 'update')
  updateScheduleItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateActivityScheduleItemDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.activities.updateScheduleItem(id, itemId, dto, user);
  }

  @Delete(':id/schedule/:itemId')
  @RequirePermission('task_instances', 'update')
  deleteScheduleItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: RbacUser,
  ) {
    return this.activities.deleteScheduleItem(id, itemId, user);
  }

  @Get(':id/schedule/pdf')
  @RequirePermission('reports', 'download')
  async exportSchedulePdf(
    @Param('id') id: string,
    @CurrentUser() user: RbacUser,
    @Res() res: Response,
  ) {
    const { fileName, buffer } = await this.activities.buildSchedulePdf(id, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(buffer);
  }

  @Put(':id/report')
  @RequirePermission('reports', 'create')
  upsertReport(@Param('id') id: string, @Body() dto: UpsertActivityReportDto, @CurrentUser() user: RbacUser) {
    return this.activities.upsertReport(id, dto, user);
  }

  @Post(':id/report/sign')
  @RequirePermission('reports', 'approve')
  signReport(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.activities.signReport(id, user);
  }

  @Post(':id/report/photos')
  @RequirePermission('reports', 'upload')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${file.originalname}`;
          cb(null, unique);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowed = ['image/png', 'image/jpeg'];
        if (!allowed.includes(file.mimetype)) {
          (req as Request & { fileValidationError?: string }).fileValidationError = 'FILE_TYPE_INVALID';
          return cb(null, false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request & { fileValidationError?: string },
    @CurrentUser() user: RbacUser,
  ) {
    if (!file) {
      if (req.fileValidationError === 'FILE_TYPE_INVALID') {
        throwError('FILE_TYPE_INVALID');
      }
      throwError('VALIDATION_ERROR', { reason: 'FILE_REQUIRED' });
    }

    const fileUrl = `/activities/report-files/${file.filename}`;
    const filePath = path.join(uploadDir, file.filename);
    const buffer = fs.readFileSync(filePath);
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    return this.activities.addReportPhoto(
      id,
      {
        fileName: file.originalname,
        fileUrl,
        storageKey: file.filename,
        mimeType: file.mimetype,
        fileSize: file.size,
        checksum,
      },
      user,
    );
  }

  @Delete(':id/report/photos/:photoId')
  @RequirePermission('reports', 'update')
  removePhoto(
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @CurrentUser() user: RbacUser,
  ) {
    return this.activities.removeReportPhoto(id, photoId, user);
  }

  @Get(':id/report/pdf')
  @RequirePermission('reports', 'download')
  async exportReportPdf(
    @Param('id') id: string,
    @CurrentUser() user: RbacUser,
    @Res() res: Response,
  ) {
    const { fileName, buffer } = await this.activities.buildReportPdf(id, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(buffer);
  }

  @Get('report-files/:filename')
  @RequirePermission('reports', 'download')
  downloadReportFile(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = path.join(uploadDir, filename);
    if (!fs.existsSync(filePath)) {
      throwError('NOT_FOUND');
    }
    return res.sendFile(filePath);
  }
}
