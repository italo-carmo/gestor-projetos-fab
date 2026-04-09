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
import { hasAnyRole, ROLE_TI } from '../rbac/role-access';
import type { RbacUser } from '../rbac/rbac.types';
import { BiDomesticViolenceService } from './bi-domestic-violence.service';

@Controller('bi/domestic-violence')
@UseGuards(JwtAuthGuard, RbacGuard)
export class BiDomesticViolenceController {
  constructor(private readonly biDomesticViolence: BiDomesticViolenceService) {}

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
    @Query('organization') organization: string | undefined,
    @Query('rank') rank: string | undefined,
    @Query('maritalStatus') maritalStatus: string | undefined,
    @Query('education') education: string | undefined,
    @Query('naturality') naturality: string | undefined,
    @Query('fabBond') fabBond: string | undefined,
    @Query('situationScope') situationScope: string | undefined,
    @Query('sufferedLifetime') sufferedLifetime: string | undefined,
    @Query('sufferedLast12Months') sufferedLast12Months: string | undefined,
    @Query('frequency') frequency: string | undefined,
    @Query('affectiveBond') affectiveBond: string | undefined,
    @Query('violenceType') violenceType: string | undefined,
    @Query('authorRelation') authorRelation: string | undefined,
    @Query('impactIntensity') impactIntensity: string | undefined,
    @Query('impactArea') impactArea: string | undefined,
    @Query('soughtHelp') soughtHelp: string | undefined,
    @Query('complaintChannel') complaintChannel: string | undefined,
    @Query('noComplaintReason') noComplaintReason: string | undefined,
    @Query('authorMilitaryLink') authorMilitaryLink: string | undefined,
    @Query('occurrencePlace') occurrencePlace: string | undefined,
    @Query('witnesses') witnesses: string | undefined,
    @Query('q') q: string | undefined,
    @Query('combineMode') combineMode: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.biDomesticViolence.dashboard({
      from,
      to,
      organization,
      rank,
      maritalStatus,
      education,
      naturality,
      fabBond,
      situationScope,
      sufferedLifetime,
      sufferedLast12Months,
      frequency,
      affectiveBond,
      violenceType,
      authorRelation,
      impactIntensity,
      impactArea,
      soughtHelp,
      complaintChannel,
      noComplaintReason,
      authorMilitaryLink,
      occurrencePlace,
      witnesses,
      q,
      combineMode,
    });
  }

  @Get('responses')
  @RequirePermission('bi', 'view')
  listResponses(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('organization') organization: string | undefined,
    @Query('rank') rank: string | undefined,
    @Query('maritalStatus') maritalStatus: string | undefined,
    @Query('education') education: string | undefined,
    @Query('naturality') naturality: string | undefined,
    @Query('fabBond') fabBond: string | undefined,
    @Query('situationScope') situationScope: string | undefined,
    @Query('sufferedLifetime') sufferedLifetime: string | undefined,
    @Query('sufferedLast12Months') sufferedLast12Months: string | undefined,
    @Query('frequency') frequency: string | undefined,
    @Query('affectiveBond') affectiveBond: string | undefined,
    @Query('violenceType') violenceType: string | undefined,
    @Query('authorRelation') authorRelation: string | undefined,
    @Query('impactIntensity') impactIntensity: string | undefined,
    @Query('impactArea') impactArea: string | undefined,
    @Query('soughtHelp') soughtHelp: string | undefined,
    @Query('complaintChannel') complaintChannel: string | undefined,
    @Query('noComplaintReason') noComplaintReason: string | undefined,
    @Query('authorMilitaryLink') authorMilitaryLink: string | undefined,
    @Query('occurrencePlace') occurrencePlace: string | undefined,
    @Query('witnesses') witnesses: string | undefined,
    @Query('q') q: string | undefined,
    @Query('combineMode') combineMode: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.biDomesticViolence.listResponses({
      from,
      to,
      organization,
      rank,
      maritalStatus,
      education,
      naturality,
      fabBond,
      situationScope,
      sufferedLifetime,
      sufferedLast12Months,
      frequency,
      affectiveBond,
      violenceType,
      authorRelation,
      impactIntensity,
      impactArea,
      soughtHelp,
      complaintChannel,
      noComplaintReason,
      authorMilitaryLink,
      occurrencePlace,
      witnesses,
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
    return this.biDomesticViolence.listImports({ page, pageSize });
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

    return this.biDomesticViolence.importResponses(file, user, {
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
      organization?: string;
      rank?: string;
      maritalStatus?: string;
      education?: string;
      naturality?: string;
      fabBond?: string;
      situationScope?: string;
      sufferedLifetime?: string;
      sufferedLast12Months?: string;
      frequency?: string;
      affectiveBond?: string;
      violenceType?: string;
      authorRelation?: string;
      impactIntensity?: string;
      impactArea?: string;
      soughtHelp?: string;
      complaintChannel?: string;
      noComplaintReason?: string;
      authorMilitaryLink?: string;
      occurrencePlace?: string;
      witnesses?: string;
      q?: string;
      combineMode?: string;
    },
    @CurrentUser() user: RbacUser,
  ) {
    return this.biDomesticViolence.deleteResponses(body);
  }

  @Get('card-settings')
  @RequirePermission('bi', 'view')
  listCardSettings(@CurrentUser() user: RbacUser) {
    return this.biDomesticViolence.listCardSettings();
  }

  @Put('card-settings/:cardId')
  @RequirePermission('bi', 'upload')
  updateCardSetting(
    @Param('cardId') cardId: string,
    @Body() body: { title?: string; description?: string | null },
    @CurrentUser() user: RbacUser,
  ) {
    this.assertTiForSettings(user);
    return this.biDomesticViolence.updateCardSetting(cardId, body, user);
  }
}
