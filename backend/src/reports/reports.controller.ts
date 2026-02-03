import { Body, Controller, Get, Param, Post, Put, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RbacUser } from '../rbac/rbac.types';
import { ReportsService } from './reports.service';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

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
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${file.originalname}`;
          cb(null, unique);
        },
      }),
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('taskInstanceId') taskInstanceId: string,
    @CurrentUser() user: RbacUser,
  ) {
    const fileUrl = `/reports/files/${file.filename}`;
    return this.reports.createReport({
      taskInstanceId,
      fileName: file.originalname,
      fileUrl,
    }, user);
  }

  @Get(':id/download')
  @RequirePermission('reports', 'download')
  async download(@Param('id') id: string, @Res() res: Response, @CurrentUser() user: RbacUser) {
    const report = await this.reports.getReport(id, user);
    const fileName = path.basename(report.fileUrl);
    const filePath = path.join(uploadDir, fileName);
    return res.download(filePath, report.fileName);
  }

  @Put(':id/approve')
  @RequirePermission('reports', 'approve')
  approve(@Param('id') id: string, @Body('approved') approved: boolean, @CurrentUser() user: RbacUser) {
    return this.reports.approveReport(id, approved, user);
  }
}
