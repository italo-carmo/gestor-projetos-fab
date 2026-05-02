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
import { type BiImportNormalizationPlan } from './bi-normalization.service';
import { BiPdfService } from './bi-pdf.service';
import { BiBestPracticesCycleService } from './bi-best-practices-cycle.service';

function parseTruthyBodyFlag(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  return typeof value === 'string'
    ? ['1', 'true', 'sim', 'yes'].includes(value.toLowerCase().trim())
    : false;
}

function parseNormalizationPlan(
  value: unknown,
): BiImportNormalizationPlan | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as BiImportNormalizationPlan;
  }
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as BiImportNormalizationPlan;
  } catch {
    throwError('VALIDATION_ERROR', {
      field: 'normalizationPlan',
      reason: 'INVALID_JSON',
    });
  }
}

@Controller('bi/best-practices-cycle')
@UseGuards(JwtAuthGuard, RbacGuard)
export class BiBestPracticesCycleController {
  constructor(
    private readonly biBestPracticesCycle: BiBestPracticesCycleService,
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
    @Query('technicalRigorPerception')
    technicalRigorPerception: string | undefined,
    @Query('preparednessToLeadMixedClass')
    preparednessToLeadMixedClass: string | undefined,
    @Query('genderBiasImpact') genderBiasImpact: string | undefined,
    @Query('interactionDifference') interactionDifference: string | undefined,
    @Query('supportNeedRecognition') supportNeedRecognition: string | undefined,
    @Query('mainChallengeOption') mainChallengeOption: string | undefined,
    @Query('identification') identification: string | undefined,
    @Query('specialty') specialty: string | undefined,
    @Query('q') q: string | undefined,
    @Query('combineMode') combineMode: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.biBestPracticesCycle.dashboard({
      from,
      to,
      technicalRigorPerception,
      preparednessToLeadMixedClass,
      genderBiasImpact,
      interactionDifference,
      supportNeedRecognition,
      mainChallengeOption,
      identification,
      specialty,
      q,
      combineMode,
    });
  }

  @Get('dashboard/pdf')
  @RequirePermission('bi', 'view')
  async dashboardPdf(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('technicalRigorPerception')
    technicalRigorPerception: string | undefined,
    @Query('preparednessToLeadMixedClass')
    preparednessToLeadMixedClass: string | undefined,
    @Query('genderBiasImpact') genderBiasImpact: string | undefined,
    @Query('interactionDifference') interactionDifference: string | undefined,
    @Query('supportNeedRecognition') supportNeedRecognition: string | undefined,
    @Query('mainChallengeOption') mainChallengeOption: string | undefined,
    @Query('identification') identification: string | undefined,
    @Query('specialty') specialty: string | undefined,
    @Query('q') q: string | undefined,
    @Query('combineMode') combineMode: string | undefined,
    @Res() res: Response,
  ) {
    const buffer = await this.biPdf.bestPracticesCycleDashboardPdf({
      from,
      to,
      technicalRigorPerception,
      preparednessToLeadMixedClass,
      genderBiasImpact,
      interactionDifference,
      supportNeedRecognition,
      mainChallengeOption,
      identification,
      specialty,
      q,
      combineMode,
    });
    const filename = `bi-ciclo-boas-praticas-${new Date().toISOString().slice(0, 10)}.pdf`;
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
    @Query('technicalRigorPerception')
    technicalRigorPerception: string | undefined,
    @Query('preparednessToLeadMixedClass')
    preparednessToLeadMixedClass: string | undefined,
    @Query('genderBiasImpact') genderBiasImpact: string | undefined,
    @Query('interactionDifference') interactionDifference: string | undefined,
    @Query('supportNeedRecognition') supportNeedRecognition: string | undefined,
    @Query('mainChallengeOption') mainChallengeOption: string | undefined,
    @Query('identification') identification: string | undefined,
    @Query('specialty') specialty: string | undefined,
    @Query('q') q: string | undefined,
    @Query('combineMode') combineMode: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.biBestPracticesCycle.listResponses({
      from,
      to,
      technicalRigorPerception,
      preparednessToLeadMixedClass,
      genderBiasImpact,
      interactionDifference,
      supportNeedRecognition,
      mainChallengeOption,
      identification,
      specialty,
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
    return this.biBestPracticesCycle.listImports({ page, pageSize });
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
    @Body('replace') replace: unknown,
    @Body('preview') preview: unknown,
    @Body('normalizationPlan') normalizationPlan: unknown,
    @Req() req: Request & { fileValidationError?: string },
    @CurrentUser() user: RbacUser,
  ) {
    if (!file) {
      if (req.fileValidationError === 'BI_FILE_TYPE_INVALID') {
        throwError('BI_FILE_TYPE_INVALID');
      }
      throwError('VALIDATION_ERROR', { reason: 'FILE_REQUIRED' });
    }

    return this.biBestPracticesCycle.importResponses(file, user, {
      replaceAll: parseTruthyBodyFlag(replace),
      previewOnly: parseTruthyBodyFlag(preview),
      normalizationPlan: parseNormalizationPlan(normalizationPlan),
    });
  }

  @Post('import-api')
  @RequirePermission('bi', 'upload')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  importResponsesFromApi(
    @Body('replace') replace: unknown,
    @Body('preview') preview: unknown,
    @Body('normalizationPlan') normalizationPlan: unknown,
    @CurrentUser() user: RbacUser,
  ) {
    return this.biBestPracticesCycle.importResponsesFromApi(user, {
      replaceAll: parseTruthyBodyFlag(replace),
      previewOnly: parseTruthyBodyFlag(preview),
      normalizationPlan: parseNormalizationPlan(normalizationPlan),
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
      technicalRigorPerception?: string;
      preparednessToLeadMixedClass?: string;
      genderBiasImpact?: string;
      interactionDifference?: string;
      supportNeedRecognition?: string;
      mainChallengeOption?: string;
      identification?: string;
      specialty?: string;
      q?: string;
      combineMode?: string;
    },
    @CurrentUser() user: RbacUser,
  ) {
    return this.biBestPracticesCycle.deleteResponses(body);
  }

  @Get('card-settings')
  @RequirePermission('bi', 'view')
  listCardSettings(@CurrentUser() user: RbacUser) {
    return this.biBestPracticesCycle.listCardSettings();
  }

  @Put('card-settings/:cardId')
  @RequirePermission('bi', 'upload')
  updateCardSetting(
    @Param('cardId') cardId: string,
    @Body() body: { title?: string; description?: string | null },
    @CurrentUser() user: RbacUser,
  ) {
    this.assertTiForSettings(user);
    return this.biBestPracticesCycle.updateCardSetting(cardId, body, user);
  }
}
