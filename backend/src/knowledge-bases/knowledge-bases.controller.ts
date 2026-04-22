import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Res,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import type { RbacUser } from '../rbac/rbac.types';
import { MulterExceptionFilter } from '../reports/multer-exception.filter';
import { KnowledgeBasesService } from './knowledge-bases.service';
import {
  getKnowledgeBaseDocumentsDir,
  resolveExistingKnowledgeBaseDocumentPath,
} from './knowledge-base-storage';

const knowledgeBaseDocumentsDir = path.resolve(getKnowledgeBaseDocumentsDir());

if (!fs.existsSync(knowledgeBaseDocumentsDir)) {
  fs.mkdirSync(knowledgeBaseDocumentsDir, { recursive: true });
}

@Controller('admin/knowledge-bases')
@UseGuards(JwtAuthGuard, RbacGuard)
export class KnowledgeBasesController {
  constructor(private readonly knowledgeBases: KnowledgeBasesService) {}

  @Get()
  @RequirePermission('admin_rbac', 'update')
  listKnowledgeBases() {
    return this.knowledgeBases.listKnowledgeBases();
  }

  @Get('selectable')
  @RequirePermission('admin_rbac', 'update')
  listSelectableKnowledgeBases() {
    return this.knowledgeBases.listSelectableKnowledgeBases();
  }

  @Post()
  @RequirePermission('admin_rbac', 'update')
  createKnowledgeBase(
    @Body()
    body: {
      key?: string;
      name?: string;
      description?: string | null;
      theme?: string | null;
      isActive?: boolean;
      sortOrder?: number | null;
    },
    @CurrentUser() user: RbacUser,
  ) {
    return this.knowledgeBases.createKnowledgeBase(body, user);
  }

  @Put(':id')
  @RequirePermission('admin_rbac', 'update')
  updateKnowledgeBase(
    @Param('id') id: string,
    @Body()
    body: {
      key?: string;
      name?: string;
      description?: string | null;
      theme?: string | null;
      isActive?: boolean;
      sortOrder?: number | null;
    },
    @CurrentUser() user: RbacUser,
  ) {
    return this.knowledgeBases.updateKnowledgeBase(id, body, user);
  }

  @Delete(':id')
  @RequirePermission('admin_rbac', 'update')
  deleteKnowledgeBase(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.knowledgeBases.deleteKnowledgeBase(id, user);
  }

  @Get(':id/documents')
  @RequirePermission('admin_rbac', 'update')
  listDocuments(@Param('id') id: string) {
    return this.knowledgeBases.listKnowledgeBaseDocuments(id);
  }

  @Post(':id/documents/upload')
  @RequirePermission('admin_rbac', 'update')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: knowledgeBaseDocumentsDir,
        filename: (_req, file, cb) => {
          const extension = path.extname(file.originalname || '').toLowerCase();
          const safeExtension =
            extension && extension.length <= 10 ? extension : '.bin';
          cb(null, `${Date.now()}-${randomUUID()}${safeExtension}`);
        },
      }),
      limits: { fileSize: 30 * 1024 * 1024 },
    }),
  )
  @UseFilters(MulterExceptionFilter)
  uploadDocument(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { title?: string | null },
    @CurrentUser() user: RbacUser,
  ) {
    return this.knowledgeBases.uploadDocument(id, file, body, user);
  }

  @Put('documents/:id')
  @RequirePermission('admin_rbac', 'update')
  updateDocument(
    @Param('id') id: string,
    @Body() body: { title?: string | null },
    @CurrentUser() user: RbacUser,
  ) {
    return this.knowledgeBases.updateDocument(id, body, user);
  }

  @Delete('documents/:id')
  @RequirePermission('admin_rbac', 'update')
  deleteDocument(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.knowledgeBases.deleteDocument(id, user);
  }

  @Post(':id/reindex')
  @RequirePermission('admin_rbac', 'update')
  reindexKnowledgeBase(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.knowledgeBases.reindexKnowledgeBase(id, user);
  }

  @Post('documents/:id/reindex')
  @RequirePermission('admin_rbac', 'update')
  reindexDocument(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.knowledgeBases.reindexDocument(id, user);
  }

  @Get('documents/:id/download')
  @RequirePermission('admin_rbac', 'update')
  async downloadDocument(@Param('id') id: string, @Res() res: Response) {
    const document = await this.knowledgeBases.getKnowledgeBaseDocumentById(id);
    const storageKey =
      String(document.storageKey ?? '').trim() ||
      path.basename(String(document.fileUrl ?? '').trim());
    const filePath = resolveExistingKnowledgeBaseDocumentPath(storageKey);
    if (!filePath) {
      return res.status(404).json({
        message: 'Arquivo indisponível para download.',
        code: 'NOT_FOUND',
      });
    }
    res.setHeader('Cache-Control', 'private, no-store');
    return res.download(filePath, document.fileName || document.title || 'base-conhecimento');
  }
}
