import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import type { RbacUser } from '../rbac/rbac.types';
import { StrategicService } from './strategic.service';

@Controller('strategic')
@UseGuards(JwtAuthGuard, RbacGuard)
export class StrategicController {
  constructor(private readonly service: StrategicService) {}

  @Get('dashboard')
  @RequirePermission('bi', 'view')
  dashboard() {
    return this.service.situationalDashboard();
  }

  @Get('comgep-room')
  @RequirePermission('bi', 'view')
  comgepRoom() {
    return this.service.comgepSituationRoom();
  }

  @Get('comgep-recommendations')
  @RequirePermission('bi', 'view')
  listComgepRecommendations(@Query('limit') limit: string | undefined) {
    return this.service.listComgepRecommendations(Number(limit ?? 8));
  }

  @Post('comgep-recommendations')
  @RequirePermission('bi', 'view')
  createComgepRecommendation(
    @Body()
    body: {
      title: string;
      summary: string;
      sessionId?: string | null;
      sourceAgentType: string;
      mode: string;
      focusType?: string | null;
      focusLabel?: string | null;
      uf?: string | null;
      omId?: string | null;
      evidence?: unknown;
    },
    @CurrentUser() user: RbacUser,
  ) {
    return this.service.createComgepRecommendation(body, user);
  }

  @Get('aggressor-profile')
  @RequirePermission('bi', 'view')
  aggressorProfile() {
    return this.service.aggressorProfile();
  }

  @Get('text-analysis')
  @RequirePermission('bi', 'view')
  textAnalysis() {
    return this.service.textAnalysis();
  }

  @Get('geo-map')
  @RequirePermission('bi', 'view')
  geoMap() {
    return this.service.geoMap();
  }

  /**
   * Dois métodos explícitos: em alguns deploys o bundle antigo só tinha POST;
   * o frontend usa GET (como as outras rotas /strategic/*).
   */
  @Get('ai-narrative')
  @RequirePermission('bi', 'view')
  getAiNarrative() {
    return this.service.strategicAiNarrative();
  }

  @Post('ai-narrative')
  @RequirePermission('bi', 'view')
  postAiNarrative() {
    return this.service.strategicAiNarrative();
  }

  @Get('executive-report/pdf')
  @RequirePermission('bi', 'view')
  async executiveReportPdf(@Res() res: Response) {
    const buffer = await this.service.executiveReportPdf();
    const filename = `relatorio-executivo-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
