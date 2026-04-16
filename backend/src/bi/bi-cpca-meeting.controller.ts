import {
  Body,
  Controller,
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
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { throwError } from '../common/http-error';
import { MulterExceptionFilter } from '../reports/multer-exception.filter';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { hasAnyRole, ROLE_TI } from '../rbac/role-access';
import type { RbacUser } from '../rbac/rbac.types';
import { BiPdfService } from './bi-pdf.service';
import { BiCpcaMeetingService } from './bi-cpca-meeting.service';

@Controller('bi/cpca-meeting')
@UseGuards(JwtAuthGuard, RbacGuard)
export class BiCpcaMeetingController {
  constructor(
    private readonly biCpcaMeeting: BiCpcaMeetingService,
    private readonly biPdf: BiPdfService,
  ) {}

  private assertTiForSettings(user: RbacUser) {
    if (!hasAnyRole(user, [ROLE_TI])) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  @Get('dashboard')
  @RequirePermission('bi', 'view')
  dashboard(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('q') q: string | undefined,
    @Query('combineMode') combineMode: string | undefined,
    @Query('columnFilters') columnFilters: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.biCpcaMeeting.dashboard({
      from,
      to,
      q,
      combineMode,
      columnFilters,
    });
  }

  @Get('dashboard/pdf')
  @RequirePermission('bi', 'view')
  async dashboardPdf(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('q') q: string | undefined,
    @Query('combineMode') combineMode: string | undefined,
    @Query('columnFilters') columnFilters: string | undefined,
    @Res() res: Response,
  ) {
    const buffer = await this.biPdf.cpcaMeetingDashboardPdf({
      from,
      to,
      q,
      combineMode,
      columnFilters,
    });
    const filename = `bi-encontro-cpca-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('responses')
  @RequirePermission('bi', 'view')
  listResponses(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('q') q: string | undefined,
    @Query('combineMode') combineMode: string | undefined,
    @Query('columnFilters') columnFilters: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.biCpcaMeeting.listResponses({
      from,
      to,
      q,
      combineMode,
      columnFilters,
      page,
      pageSize,
    });
  }

  @Get('imports')
  @RequirePermission('bi', 'view')
  listImports(
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.biCpcaMeeting.listImports({ page, pageSize });
  }

  @Post('import')
  @RequirePermission('bi', 'upload')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const lowerName = file.originalname.toLowerCase();
        const accepted =
          lowerName.endsWith('.csv') ||
          lowerName.endsWith('.xlsx') ||
          lowerName.endsWith('.xls');

        if (!accepted) {
          (
            req as Request & { fileValidationError?: string }
          ).fileValidationError = 'BI_FILE_TYPE_INVALID';
          return cb(null, false);
        }

        cb(null, true);
      },
    }),
  )
  importResponses(
    @UploadedFile() file: Express.Multer.File,
    @Body('replace') replace: string | undefined,
    @Req() req: Request & { fileValidationError?: string },
    @CurrentUser() user: RbacUser,
  ) {
    if (!file) {
      if (req.fileValidationError === 'BI_FILE_TYPE_INVALID') {
        throwError('BI_FILE_TYPE_INVALID');
      }
      throwError('VALIDATION_ERROR', { reason: 'FILE_REQUIRED' });
    }

    const replaceAll =
      typeof replace === 'string'
        ? ['1', 'true', 'sim', 'yes'].includes(replace.toLowerCase().trim())
        : false;

    return this.biCpcaMeeting.importResponses(file, user, {
      replaceAll,
    });
  }

  @Post('responses/delete')
  @RequirePermission('bi', 'delete')
  deleteResponses(
    @Body()
    body: {
      ids?: string[];
      allFiltered?: boolean;
      from?: string;
      to?: string;
      q?: string;
      combineMode?: string;
      columnFilters?: Record<string, string> | string;
    },
    @CurrentUser() user: RbacUser,
  ) {
    return this.biCpcaMeeting.deleteResponses(body);
  }

  @Get('card-settings')
  @RequirePermission('bi', 'view')
  listCardSettings(@CurrentUser() user: RbacUser) {
    return this.biCpcaMeeting.listCardSettings();
  }

  @Put('card-settings/:cardId')
  @RequirePermission('bi', 'upload')
  updateCardSetting(
    @Param('cardId') cardId: string,
    @Body() body: { title?: string; description?: string | null },
    @CurrentUser() user: RbacUser,
  ) {
    this.assertTiForSettings(user);
    return this.biCpcaMeeting.updateCardSetting(cardId, body, user);
  }
}
