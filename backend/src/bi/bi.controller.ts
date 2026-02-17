import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { throwError } from '../common/http-error';
import { MulterExceptionFilter } from '../reports/multer-exception.filter';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import type { RbacUser } from '../rbac/rbac.types';
import { BiService } from './bi.service';

@Controller('bi')
@UseGuards(JwtAuthGuard, RbacGuard)
export class BiController {
  constructor(private readonly bi: BiService) {}

  @Get('surveys/dashboard')
  @RequirePermission('dashboard', 'view')
  dashboard(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('om') om: string | undefined,
    @Query('posto') posto: string | undefined,
    @Query('postoGraduacao') postoGraduacao: string | undefined,
    @Query('autodeclara') autodeclara: string | undefined,
    @Query('suffered') suffered: string | undefined,
    @Query('violenceType') violenceType: string | undefined,
    @Query('combineMode') combineMode: string | undefined,
  ) {
    return this.bi.dashboard({
      from,
      to,
      om,
      posto,
      postoGraduacao,
      autodeclara,
      suffered,
      violenceType,
      combineMode,
    });
  }

  @Get('surveys/responses')
  @RequirePermission('dashboard', 'view')
  listResponses(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('om') om: string | undefined,
    @Query('posto') posto: string | undefined,
    @Query('postoGraduacao') postoGraduacao: string | undefined,
    @Query('autodeclara') autodeclara: string | undefined,
    @Query('suffered') suffered: string | undefined,
    @Query('violenceType') violenceType: string | undefined,
    @Query('q') q: string | undefined,
    @Query('combineMode') combineMode: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
  ) {
    return this.bi.listResponses({
      from,
      to,
      om,
      posto,
      postoGraduacao,
      autodeclara,
      suffered,
      violenceType,
      q,
      combineMode,
      page,
      pageSize,
    });
  }

  @Get('surveys/imports')
  @RequirePermission('dashboard', 'view')
  listImports(
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
  ) {
    return this.bi.listImports({ page, pageSize });
  }

  @Post('surveys/import')
  @RequirePermission('dashboard', 'view')
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
  importSurvey(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request & { fileValidationError?: string },
    @CurrentUser() user: RbacUser,
  ) {
    if (!file) {
      if (req.fileValidationError === 'BI_FILE_TYPE_INVALID') {
        throwError('BI_FILE_TYPE_INVALID');
      }
      throwError('VALIDATION_ERROR', { reason: 'FILE_REQUIRED' });
    }

    return this.bi.importSurvey(file, user);
  }

  @Post('surveys/responses/delete')
  @RequirePermission('dashboard', 'view')
  deleteResponses(
    @Body()
    body: {
      ids?: string[];
      allFiltered?: boolean;
      from?: string;
      to?: string;
      om?: string;
      posto?: string;
      postoGraduacao?: string;
      autodeclara?: string;
      suffered?: string;
      violenceType?: string;
      q?: string;
      combineMode?: string;
    },
  ) {
    return this.bi.deleteResponses(body);
  }
}
