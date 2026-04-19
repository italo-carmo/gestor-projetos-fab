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
import {
  BiPdfService,
  type BiExecutiveNotebookPanelKey,
} from './bi-pdf.service';
import { BiService } from './bi.service';

function parseTruthyBodyFlag(value: string | undefined) {
  return typeof value === 'string'
    ? ['1', 'true', 'sim', 'yes'].includes(value.toLowerCase().trim())
    : false;
}

function parseNormalizationPlan(
  value: string | undefined,
): BiImportNormalizationPlan | null {
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

@Controller('bi')
@UseGuards(JwtAuthGuard, RbacGuard)
export class BiController {
  constructor(
    private readonly bi: BiService,
    private readonly biPdf: BiPdfService,
  ) {}

  private assertTiForSettings(user: RbacUser) {
    if (!hasAnyRole(user, [ROLE_TI])) {
      throwError('RBAC_FORBIDDEN');
    }
  }

  @Get('surveys/dashboard')
  @RequirePermission('bi', 'view')
  dashboard(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('mission') mission: string | undefined,
    @Query('om') om: string | undefined,
    @Query('posto') posto: string | undefined,
    @Query('postoGraduacao') postoGraduacao: string | undefined,
    @Query('autodeclara') autodeclara: string | undefined,
    @Query('suffered') suffered: string | undefined,
    @Query('violenceType') violenceType: string | undefined,
    @Query('combineMode') combineMode: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.bi.dashboard({
      from,
      to,
      mission,
      om,
      posto,
      postoGraduacao,
      autodeclara,
      suffered,
      violenceType,
      combineMode,
    });
  }

  @Get('surveys/dashboard/pdf')
  @RequirePermission('bi', 'view')
  async dashboardPdf(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('mission') mission: string | undefined,
    @Query('om') om: string | undefined,
    @Query('posto') posto: string | undefined,
    @Query('postoGraduacao') postoGraduacao: string | undefined,
    @Query('autodeclara') autodeclara: string | undefined,
    @Query('suffered') suffered: string | undefined,
    @Query('violenceType') violenceType: string | undefined,
    @Query('combineMode') combineMode: string | undefined,
    @Res() res: Response,
  ) {
    const buffer = await this.biPdf.surveysDashboardPdf({
      from,
      to,
      mission,
      om,
      posto,
      postoGraduacao,
      autodeclara,
      suffered,
      violenceType,
      combineMode,
    });
    const filename = `bi-pesquisa-institucional-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Post('executive-notebook/pdf')
  @RequirePermission('bi', 'view')
  async executiveNotebookPdf(
    @Body()
    body:
      | {
          title?: string;
          panels?: Array<{
            key?: string;
            filters?: Record<string, unknown>;
          }>;
        }
      | undefined,
    @Res() res: Response,
  ) {
    const buffer = await this.biPdf.executiveNotebookPdf({
      title: body?.title,
      panels: body?.panels?.map((panel) => ({
        key: String(panel?.key ?? '').trim() as BiExecutiveNotebookPanelKey,
        filters:
          panel?.filters && typeof panel.filters === 'object'
            ? { ...panel.filters }
            : undefined,
      })),
    });
    const filename = `caderno-executivo-bi-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('surveys/responses')
  @RequirePermission('bi', 'view')
  listResponses(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('mission') mission: string | undefined,
    @Query('om') om: string | undefined,
    @Query('posto') posto: string | undefined,
    @Query('postoGraduacao') postoGraduacao: string | undefined,
    @Query('autodeclara') autodeclara: string | undefined,
    @Query('suffered') suffered: string | undefined,
    @Query('violenceType') violenceType: string | undefined,
    @Query('responseId') responseId: string | undefined,
    @Query('q') q: string | undefined,
    @Query('combineMode') combineMode: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.bi.listResponses({
      from,
      to,
      mission,
      om,
      posto,
      postoGraduacao,
      autodeclara,
      suffered,
      violenceType,
      responseId,
      q,
      combineMode,
      page,
      pageSize,
    });
  }

  @Get('surveys/questions')
  @RequirePermission('bi', 'view')
  listQuestions(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('mission') mission: string | undefined,
    @Query('om') om: string | undefined,
    @Query('posto') posto: string | undefined,
    @Query('postoGraduacao') postoGraduacao: string | undefined,
    @Query('autodeclara') autodeclara: string | undefined,
    @Query('suffered') suffered: string | undefined,
    @Query('violenceType') violenceType: string | undefined,
    @Query('q') q: string | undefined,
    @Query('combineMode') combineMode: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.bi.listQuestions({
      from,
      to,
      mission,
      om,
      posto,
      postoGraduacao,
      autodeclara,
      suffered,
      violenceType,
      q,
      combineMode,
    });
  }

  @Get('surveys/imports')
  @RequirePermission('bi', 'view')
  listImports(
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.bi.listImports({ page, pageSize });
  }

  @Post('surveys/import')
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
  importSurvey(
    @UploadedFile() file: Express.Multer.File,
    @Body('replace') replace: string | undefined,
    @Body('preview') preview: string | undefined,
    @Body('normalizationPlan') normalizationPlan: string | undefined,
    @Req() req: Request & { fileValidationError?: string },
    @CurrentUser() user: RbacUser,
  ) {
    if (!file) {
      if (req.fileValidationError === 'BI_FILE_TYPE_INVALID') {
        throwError('BI_FILE_TYPE_INVALID');
      }
      throwError('VALIDATION_ERROR', { reason: 'FILE_REQUIRED' });
    }

    return this.bi.importSurvey(file, user, {
      replaceAll: parseTruthyBodyFlag(replace),
      previewOnly: parseTruthyBodyFlag(preview),
      normalizationPlan: parseNormalizationPlan(normalizationPlan),
    });
  }

  @Post('surveys/responses/delete')
  @RequirePermission('bi', 'delete')
  deleteResponses(
    @Body()
    body: {
      ids?: string[];
      allFiltered?: boolean;
      from?: string;
      to?: string;
      mission?: string;
      om?: string;
      posto?: string;
      postoGraduacao?: string;
      autodeclara?: string;
      suffered?: string;
      violenceType?: string;
      q?: string;
      combineMode?: string;
    },
    @CurrentUser() user: RbacUser,
  ) {
    return this.bi.deleteResponses(body);
  }

  @Get('surveys/card-settings')
  @RequirePermission('bi', 'view')
  listCardSettings(@CurrentUser() user: RbacUser) {
    return this.bi.listCardSettings();
  }

  @Put('surveys/card-settings/:cardId')
  @RequirePermission('bi', 'upload')
  updateCardSetting(
    @Param('cardId') cardId: string,
    @Body() body: { title?: string; description?: string | null },
    @CurrentUser() user: RbacUser,
  ) {
    this.assertTiForSettings(user);
    return this.bi.updateCardSetting(cardId, body, user);
  }
}
