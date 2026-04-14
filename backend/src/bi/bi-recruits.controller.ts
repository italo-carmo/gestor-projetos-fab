import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
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
import { hasAnyRole, ROLE_COMGEP, ROLE_TI } from '../rbac/role-access';
import type { RbacUser } from '../rbac/rbac.types';
import { BiRecruitsService } from './bi-recruits.service';

@Controller('bi/recruits')
@UseGuards(JwtAuthGuard, RbacGuard)
export class BiRecruitsController {
  constructor(private readonly biRecruits: BiRecruitsService) {}

  private assertRecruitsAccess(user: RbacUser) {
    if (!hasAnyRole(user, [ROLE_TI, ROLE_COMGEP])) {
      throwError('RBAC_FORBIDDEN');
    }
  }

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
    @Query('education') education: string | undefined,
    @Query('gender') gender: string | undefined,
    @Query('identifyHarassment') identifyHarassment: string | undefined,
    @Query('conductLimits') conductLimits: string | undefined,
    @Query('knowOrientation') knowOrientation: string | undefined,
    @Query('knowReportProcess') knowReportProcess: string | undefined,
    @Query('willingnessOrientation') willingnessOrientation: string | undefined,
    @Query('willingnessReport') willingnessReport: string | undefined,
    @Query('enlistmentDecisionInfluence')
    enlistmentDecisionInfluence: string | undefined,
    @Query('responseId') responseId: string | undefined,
    @Query('q') q: string | undefined,
    @Query('combineMode') combineMode: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    this.assertRecruitsAccess(user);
    return this.biRecruits.dashboard({
      from,
      to,
      education,
      gender,
      identifyHarassment,
      conductLimits,
      knowOrientation,
      knowReportProcess,
      willingnessOrientation,
      willingnessReport,
      enlistmentDecisionInfluence,
      responseId,
      q,
      combineMode,
    });
  }

  @Get('responses')
  @RequirePermission('bi', 'view')
  listResponses(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('education') education: string | undefined,
    @Query('gender') gender: string | undefined,
    @Query('identifyHarassment') identifyHarassment: string | undefined,
    @Query('conductLimits') conductLimits: string | undefined,
    @Query('knowOrientation') knowOrientation: string | undefined,
    @Query('knowReportProcess') knowReportProcess: string | undefined,
    @Query('willingnessOrientation') willingnessOrientation: string | undefined,
    @Query('willingnessReport') willingnessReport: string | undefined,
    @Query('enlistmentDecisionInfluence')
    enlistmentDecisionInfluence: string | undefined,
    @Query('q') q: string | undefined,
    @Query('combineMode') combineMode: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    this.assertRecruitsAccess(user);
    return this.biRecruits.listResponses({
      from,
      to,
      education,
      gender,
      identifyHarassment,
      conductLimits,
      knowOrientation,
      knowReportProcess,
      willingnessOrientation,
      willingnessReport,
      enlistmentDecisionInfluence,
      q,
      combineMode,
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
    this.assertRecruitsAccess(user);
    return this.biRecruits.listImports({ page, pageSize });
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
    this.assertRecruitsAccess(user);

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

    return this.biRecruits.importResponses(file, user, {
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
      education?: string;
      gender?: string;
      identifyHarassment?: string;
      conductLimits?: string;
      knowOrientation?: string;
      knowReportProcess?: string;
      willingnessOrientation?: string;
      willingnessReport?: string;
      enlistmentDecisionInfluence?: string;
      q?: string;
      combineMode?: string;
    },
    @CurrentUser() user: RbacUser,
  ) {
    this.assertRecruitsAccess(user);
    return this.biRecruits.deleteResponses(body);
  }

  @Get('card-settings')
  @RequirePermission('bi', 'view')
  listCardSettings(@CurrentUser() user: RbacUser) {
    this.assertRecruitsAccess(user);
    return this.biRecruits.listCardSettings();
  }

  @Put('card-settings/:cardId')
  @RequirePermission('bi', 'upload')
  updateCardSetting(
    @Param('cardId') cardId: string,
    @Body() body: { title?: string; description?: string | null },
    @CurrentUser() user: RbacUser,
  ) {
    this.assertRecruitsAccess(user);
    this.assertTiForSettings(user);
    return this.biRecruits.updateCardSetting(cardId, body, user);
  }
}
