import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
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
