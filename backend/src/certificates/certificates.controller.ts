import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import type { RbacUser } from '../rbac/rbac.types';
import { CertificatesService } from './certificates.service';
import {
  CreateCertificateEventDto,
  CreateCertificateTemplateDto,
  SendCertificateEmailsDto,
  SubmitCertificateFormDto,
  UpdateCertificateEventDto,
  UpdateCertificateFormDto,
  UpdateCertificateTemplateDto,
} from './dto/certificates.dto';

@Controller('certificates')
@UseGuards(JwtAuthGuard, RbacGuard)
export class CertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Get('templates')
  @RequirePermission('certificate_templates', 'view')
  listTemplates() {
    return this.certificates.listTemplates();
  }

  @Post('templates')
  @RequirePermission('certificate_templates', 'create')
  createTemplate(
    @Body() dto: CreateCertificateTemplateDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.certificates.createTemplate(dto, user);
  }

  @Put('templates/:id')
  @RequirePermission('certificate_templates', 'update')
  updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateCertificateTemplateDto,
  ) {
    return this.certificates.updateTemplate(id, dto);
  }

  @Delete('templates/:id')
  @RequirePermission('certificate_templates', 'delete')
  deleteTemplate(@Param('id') id: string) {
    return this.certificates.deleteTemplate(id);
  }

  @Get('templates/:id/preview')
  @RequirePermission('certificate_templates', 'view')
  async previewTemplate(
    @Param('id') id: string,
    @Query('fullName') fullName: string | undefined,
    @Res() res: Response,
  ) {
    const buffer = await this.certificates.previewTemplate(id, fullName);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=30');
    return res.send(buffer);
  }

  @Get('events')
  @RequirePermission('certificate_events', 'view')
  listEvents() {
    return this.certificates.listEvents();
  }

  @Post('events')
  @RequirePermission('certificate_events', 'create')
  createEvent(
    @Body() dto: CreateCertificateEventDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.certificates.createEvent(dto, user);
  }

  @Get('events/:id')
  @RequirePermission('certificate_events', 'view')
  getEvent(@Param('id') id: string) {
    return this.certificates.getEvent(id);
  }

  @Put('events/:id')
  @RequirePermission('certificate_events', 'update')
  updateEvent(@Param('id') id: string, @Body() dto: UpdateCertificateEventDto) {
    return this.certificates.updateEvent(id, dto);
  }

  @Delete('events/:id')
  @RequirePermission('certificate_events', 'delete')
  deleteEvent(@Param('id') id: string) {
    return this.certificates.deleteEvent(id);
  }

  @Put('events/:id/form')
  @RequirePermission('certificate_events', 'update')
  updateForm(@Param('id') id: string, @Body() dto: UpdateCertificateFormDto) {
    return this.certificates.updateForm(id, dto);
  }

  @Post('events/:id/send-certificates')
  @RequirePermission('certificate_events', 'send')
  sendCertificates(
    @Param('id') id: string,
    @Body() dto: SendCertificateEmailsDto,
  ) {
    return this.certificates.sendCertificates(id, dto);
  }

  @Get('events/:id/responses/:responseId/certificate.pdf')
  @RequirePermission('certificate_events', 'view')
  async downloadCertificate(
    @Param('id') id: string,
    @Param('responseId') responseId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.certificates.buildCertificatePdf(id, responseId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="certificado.pdf"');
    return res.send(buffer);
  }
}

@Controller('public/certificates')
export class PublicCertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Get('forms/:slug')
  @UseGuards(ThrottlerGuard)
  getPublicForm(@Param('slug') slug: string) {
    return this.certificates.getPublicForm(slug);
  }

  @Post('forms/:slug/responses')
  @UseGuards(ThrottlerGuard)
  submitPublicForm(
    @Param('slug') slug: string,
    @Body() dto: SubmitCertificateFormDto,
  ) {
    return this.certificates.submitPublicForm(slug, dto);
  }
}
