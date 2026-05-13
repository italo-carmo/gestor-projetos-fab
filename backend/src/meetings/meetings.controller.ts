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
  UploadedFiles,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { throwError } from '../common/http-error';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import type { RbacUser } from '../rbac/rbac.types';
import { MulterExceptionFilter } from '../reports/multer-exception.filter';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { UpdateMeetingMinutesDto } from './dto/update-meeting-minutes.dto';
import { MeetingDecisionDto } from './dto/meeting-decision.dto';
import { GenerateMeetingTasksDto } from './dto/generate-meeting-tasks.dto';
import { MeetingsService } from './meetings.service';

const documentsDir = path.resolve(process.cwd(), 'storage', 'documents');
if (!fs.existsSync(documentsDir)) {
  fs.mkdirSync(documentsDir, { recursive: true });
}

@Controller('meetings')
@UseGuards(JwtAuthGuard, RbacGuard)
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get()
  @RequirePermission('meetings', 'view')
  list(
    @Query('status') status: string | undefined,
    @Query('scope') scope: string | undefined,
    @Query('localityId') localityId: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.meetings.list(
      { status, scope, localityId, from, to, page, pageSize },
      user,
    );
  }

  @Post()
  @RequirePermission('meetings', 'create')
  create(@Body() dto: CreateMeetingDto, @CurrentUser() user: RbacUser) {
    return this.meetings.create(dto, user);
  }

  @Put(':id/minutes')
  @RequirePermission('meetings', 'update')
  updateMinutes(
    @Param('id') id: string,
    @Body() dto: UpdateMeetingMinutesDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.meetings.updateMinutes(id, dto.minutes, user);
  }

  @Post(':id/minutes/files')
  @RequirePermission('meetings', 'update')
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: documentsDir,
        filename: (_req, file, cb) => {
          const extension = path.extname(file.originalname || '').toLowerCase();
          const safeExtension =
            extension && extension.length <= 10 ? extension : '.bin';
          cb(null, `${Date.now()}-${randomUUID()}${safeExtension}`);
        },
      }),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async uploadMinutesFiles(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: RbacUser,
  ) {
    if (!files?.length) {
      throwError('VALIDATION_ERROR', { reason: 'FILE_REQUIRED' });
    }

    const uploadedFiles = files.map((file) => {
      const filePath = path.join(documentsDir, file.filename);
      const buffer = fs.readFileSync(filePath);
      const checksum = createHash('sha256').update(buffer).digest('hex');
      return {
        fileName: file.originalname || file.filename,
        fileUrl: `/documents/${file.filename}`,
        storageKey: file.filename,
        mimeType: file.mimetype || null,
        fileSize: Number.isFinite(file.size) ? file.size : null,
        checksum,
      };
    });

    try {
      return await this.meetings.uploadMinutesFiles(id, uploadedFiles, user);
    } catch (error) {
      for (const file of files) {
        const filePath = path.join(documentsDir, file.filename);
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch {
          // Best-effort cleanup must not hide the original error.
        }
      }
      throw error;
    }
  }

  @Get(':id/minutes/files/:documentId/download')
  @RequirePermission('meetings', 'view')
  async downloadMinutesFile(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: RbacUser,
    @Res() res: Response,
  ) {
    const document = await this.meetings.getMinutesFileForDownload(
      id,
      documentId,
      user,
    );
    const storageKey =
      document.storageKey || path.basename(String(document.fileUrl ?? ''));
    const filePath = path.join(documentsDir, storageKey);
    if (!storageKey || !fs.existsSync(filePath)) {
      throwError('NOT_FOUND');
    }

    return res.download(filePath, document.fileName);
  }

  @Delete(':id/minutes/files/:documentId')
  @RequirePermission('meetings', 'update')
  async deleteMinutesFile(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: RbacUser,
  ) {
    const document = await this.meetings.deleteMinutesFile(
      id,
      documentId,
      user,
    );
    const storageKey =
      document.storageKey ?? path.basename(String(document.fileUrl ?? ''));
    const safeFileName = storageKey ? path.basename(storageKey) : '';

    if (safeFileName) {
      const filePath = path.join(documentsDir, safeFileName);
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch {
        // Removing the DB record is authoritative; filesystem cleanup is best effort.
      }
    }

    return { ok: true };
  }

  @Put(':id')
  @RequirePermission('meetings', 'update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMeetingDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.meetings.update(id, dto, user);
  }

  @Post(':id/decisions')
  @RequirePermission('meetings', 'update')
  addDecision(
    @Param('id') id: string,
    @Body() dto: MeetingDecisionDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.meetings.addDecision(id, dto.text, user);
  }

  @Post(':id/generate-tasks')
  @RequirePermission('tasks', 'generate_from_meeting')
  generateTasks(
    @Param('id') id: string,
    @Body() dto: GenerateMeetingTasksDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.meetings.generateTasks(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission('meetings', 'delete')
  remove(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.meetings.delete(id, user);
  }
}
