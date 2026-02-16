import { Body, Controller, Get, Param, Post, Put, Query, Req, Res, UploadedFile, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { throwError } from '../common/http-error';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import type { RbacUser } from '../rbac/rbac.types';
import { ReportsService } from './reports.service';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { MulterExceptionFilter } from './multer-exception.filter';

const uploadDir = path.resolve(process.cwd(), 'storage', 'reports');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

@Controller('reports')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post('upload')
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
        const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
        if (!allowed.includes(file.mimetype)) {
          (req as Request & { fileValidationError?: string }).fileValidationError = 'FILE_TYPE_INVALID';
          return cb(null, false);
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('taskInstanceId') taskInstanceId: string,
    @Req() req: Request & { fileValidationError?: string },
    @CurrentUser() user: RbacUser,
  ) {
    if (!file) {
      if (req.fileValidationError === 'FILE_TYPE_INVALID') {
        throwError('FILE_TYPE_INVALID');
      }
      throwError('VALIDATION_ERROR', { reason: 'FILE_REQUIRED' });
    }
    const fileUrl = `/reports/files/${file.filename}`;
    const filePath = path.join(uploadDir, file.filename);
    const buffer = fs.readFileSync(filePath);
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    return this.reports.createReport({
      taskInstanceId,
      fileName: file.originalname,
      fileUrl,
      storageKey: file.filename,
      mimeType: file.mimetype,
      fileSize: file.size,
      checksum,
    }, user);
  }

  @Get(':id/download')
  @RequirePermission('reports', 'download')
  async download(
    @Param('id') id: string,
    @Query('token') token: string | undefined,
    @Res() res: Response,
    @CurrentUser() user: RbacUser,
  ) {
    if (!token) {
      return res.status(401).send({ message: 'Token ausente', code: 'AUTH_INVALID_CREDENTIALS' });
    }
    const reportId = await this.reports.verifyDownloadToken(token);
    if (reportId !== id) {
      return res.status(401).send({ message: 'Token invalido', code: 'AUTH_INVALID_CREDENTIALS' });
    }
    const report = await this.reports.getReport(id, user);
    const fileName = report.storageKey ?? path.basename(report.fileUrl);
    const filePath = path.join(uploadDir, fileName);
    return res.download(filePath, report.fileName);
  }

  @Get(':id/signed-url')
  @RequirePermission('reports', 'download')
  signedUrl(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.reports.getSignedUrl(id, user);
  }

  @Put(':id/approve')
  @RequirePermission('reports', 'approve')
  approve(@Param('id') id: string, @Body('approved') approved: boolean, @CurrentUser() user: RbacUser) {
    return this.reports.approveReport(id, approved, user);
  }
}
