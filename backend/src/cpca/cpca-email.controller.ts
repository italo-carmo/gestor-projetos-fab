import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PermissionScope } from '@prisma/client';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { MulterExceptionFilter } from '../reports/multer-exception.filter';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import type { RbacUser } from '../rbac/rbac.types';
import {
  CPCA_EMAIL_ATTACHMENT_MAX_SIZE_BYTES,
} from './cpca-email-attachments';
import { CpcaEmailService } from './cpca-email.service';
import {
  CreateCpcaEmailTemplateDto,
  SendCpcaEmailDto,
  UpdateCpcaEmailTemplateDto,
} from './dto/cpca-email.dto';

@Controller('cpca-emails')
@UseGuards(JwtAuthGuard, RbacGuard)
export class CpcaEmailController {
  constructor(private readonly cpcaEmails: CpcaEmailService) {}

  @Get('templates')
  @RequirePermission('cpca_emails', 'view', PermissionScope.NATIONAL)
  listTemplates(@CurrentUser() user: RbacUser) {
    return this.cpcaEmails.listTemplates(user);
  }

  @Post('templates')
  @RequirePermission('cpca_emails', 'create', PermissionScope.NATIONAL)
  createTemplate(
    @Body() dto: CreateCpcaEmailTemplateDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpcaEmails.createTemplate(dto, user);
  }

  @Put('templates/:id')
  @RequirePermission('cpca_emails', 'update', PermissionScope.NATIONAL)
  updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateCpcaEmailTemplateDto,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpcaEmails.updateTemplate(id, dto, user);
  }

  @Delete('templates/:id')
  @RequirePermission('cpca_emails', 'delete', PermissionScope.NATIONAL)
  deleteTemplate(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.cpcaEmails.deleteTemplate(id, user);
  }

  @Post('templates/:id/attachments')
  @RequirePermission('cpca_emails', 'update', PermissionScope.NATIONAL)
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: CPCA_EMAIL_ATTACHMENT_MAX_SIZE_BYTES },
    }),
  )
  uploadAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpcaEmails.uploadAttachment(id, file, user);
  }

  @Delete('templates/:templateId/attachments/:attachmentId')
  @RequirePermission('cpca_emails', 'update', PermissionScope.NATIONAL)
  deleteAttachment(
    @Param('templateId') templateId: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: RbacUser,
  ) {
    return this.cpcaEmails.deleteAttachment(templateId, attachmentId, user);
  }

  @Get('recipients')
  @RequirePermission('cpca_emails', 'view', PermissionScope.NATIONAL)
  listRecipients(@CurrentUser() user: RbacUser) {
    return this.cpcaEmails.listRecipients(user);
  }

  @Post('send')
  @RequirePermission('cpca_emails', 'send', PermissionScope.NATIONAL)
  send(@Body() dto: SendCpcaEmailDto, @CurrentUser() user: RbacUser) {
    return this.cpcaEmails.sendTemplate(dto, user);
  }

  @Get('dispatches')
  @RequirePermission('cpca_emails', 'view', PermissionScope.NATIONAL)
  listDispatches(
    @CurrentUser() user: RbacUser,
    @Query('limit') limit?: string,
  ) {
    return this.cpcaEmails.listDispatches(user, { limit });
  }

  @Get('dispatches/:id')
  @RequirePermission('cpca_emails', 'view', PermissionScope.NATIONAL)
  getDispatch(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.cpcaEmails.getDispatch(id, user);
  }
}
