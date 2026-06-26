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
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import type { RbacUser } from '../rbac/rbac.types';
import { MulterExceptionFilter } from '../reports/multer-exception.filter';
import { CipavdReportsService } from './cipavd-reports.service';
import { getCipavdReportsDir } from './cipavd-reports-storage';

const cipavdReportsDir = path.resolve(getCipavdReportsDir());
const allowedExtensions = new Set(['.pdf', '.docx']);

if (!fs.existsSync(cipavdReportsDir)) {
  fs.mkdirSync(cipavdReportsDir, { recursive: true });
}

@Controller('cipavd-reports')
@UseGuards(JwtAuthGuard, RbacGuard)
export class CipavdReportsController {
  constructor(private readonly reports: CipavdReportsService) {}

  @Get()
  @RequirePermission('cipavd_reports', 'view', 'NATIONAL')
  list(
    @Query('folderId') folderId: string | undefined,
    @Query('q') q: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.reports.listFolder({ folderId, q }, user);
  }

  @Get('folder-options')
  @RequirePermission('cipavd_reports', 'view', 'NATIONAL')
  folderOptions(
    @Query('excludeFolderId') excludeFolderId: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.reports.listFolderOptions({ excludeFolderId }, user);
  }

  @Get('knowledge-base-candidates')
  @RequirePermission('cipavd_reports', 'view', 'NATIONAL')
  knowledgeBaseCandidates(
    @Query('q') q: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.reports.listKnowledgeBaseCandidates({ q }, user);
  }

  @Post('folders')
  @RequirePermission('cipavd_reports', 'create', 'NATIONAL')
  createFolder(
    @Body() body: { name?: string | null; parentId?: string | null },
    @CurrentUser() user: RbacUser,
  ) {
    return this.reports.createFolder(body, user);
  }

  @Put('folders/:id')
  @RequirePermission('cipavd_reports', 'update', 'NATIONAL')
  updateFolder(
    @Param('id') id: string,
    @Body() body: { name?: string | null; parentId?: string | null },
    @CurrentUser() user: RbacUser,
  ) {
    return this.reports.updateFolder(id, body, user);
  }

  @Delete('folders/:id')
  @RequirePermission('cipavd_reports', 'delete', 'NATIONAL')
  deleteFolder(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.reports.deleteFolder(id, user);
  }

  @Post('files/upload')
  @RequirePermission('cipavd_reports', 'upload', 'NATIONAL')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: cipavdReportsDir,
        filename: (_req, file, cb) => {
          const extension = path.extname(file.originalname || '').toLowerCase();
          const safeExtension = allowedExtensions.has(extension)
            ? extension
            : '.bin';
          cb(null, `${Date.now()}-${randomUUID()}${safeExtension}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const extension = path.extname(file.originalname || '').toLowerCase();
        cb(null, allowedExtensions.has(extension));
      },
      limits: { fileSize: 30 * 1024 * 1024 },
    }),
  )
  @UseFilters(MulterExceptionFilter)
  uploadFile(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { name?: string | null; folderId?: string | null },
    @CurrentUser() user: RbacUser,
  ) {
    return this.reports.uploadFile(file, body, user);
  }

  @Post('files/online')
  @RequirePermission('cipavd_reports', 'create', 'NATIONAL')
  createOnlineFile(
    @Body() body: { name?: string | null; folderId?: string | null },
    @CurrentUser() user: RbacUser,
  ) {
    return this.reports.createOnlineDocumentFile(body, user);
  }

  @Put('files/:id')
  @RequirePermission('cipavd_reports', 'update', 'NATIONAL')
  updateFile(
    @Param('id') id: string,
    @Body() body: { name?: string | null; folderId?: string | null },
    @CurrentUser() user: RbacUser,
  ) {
    return this.reports.updateFile(id, body, user);
  }

  @Delete('files/:id')
  @RequirePermission('cipavd_reports', 'delete', 'NATIONAL')
  deleteFile(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.reports.deleteFile(id, user);
  }

  @Get('files/:id/download')
  @RequirePermission('cipavd_reports', 'download', 'NATIONAL')
  async downloadFile(
    @Param('id') id: string,
    @CurrentUser() user: RbacUser,
    @Res() res: Response,
  ) {
    const file = await this.reports.getFileForDownload(id, user);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.download(
      file.filePath,
      file.name || file.fileName || 'relatorio',
    );
  }
}
