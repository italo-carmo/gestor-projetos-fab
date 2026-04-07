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
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import type { RbacUser } from '../rbac/rbac.types';
import { MulterExceptionFilter } from '../reports/multer-exception.filter';
import { LibraryService } from './library.service';
import {
  getLibraryDocumentsDir,
  resolveExistingLibraryDocumentPath,
} from './library-storage';

export const libraryPhotosDir = path.resolve(
  process.cwd(),
  'storage',
  'library-photos',
);
export const libraryDocumentsDir = path.resolve(getLibraryDocumentsDir());

if (!fs.existsSync(libraryPhotosDir)) {
  fs.mkdirSync(libraryPhotosDir, { recursive: true });
}
if (!fs.existsSync(libraryDocumentsDir)) {
  fs.mkdirSync(libraryDocumentsDir, { recursive: true });
}

@Controller('library')
@UseGuards(JwtAuthGuard, RbacGuard)
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get()
  @RequirePermission('library', 'view')
  list() {
    return this.library.getData();
  }

  @Put('settings')
  @RequirePermission('library', 'update')
  updateSettings(
    @Body() body: { carouselIntervalSeconds: number },
    @CurrentUser() user: RbacUser,
  ) {
    return this.library.updateSettings(
      { carouselIntervalSeconds: body.carouselIntervalSeconds },
      user,
    );
  }

  @Post('photos/upload')
  @RequirePermission('library', 'create')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: libraryPhotosDir,
        filename: (_req, file, cb) => {
          const extension = path.extname(file.originalname || '').toLowerCase();
          const safeExtension =
            extension && extension.length <= 10 ? extension : '.jpg';
          cb(null, `${Date.now()}-${randomUUID()}${safeExtension}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const mimetype = String(file.mimetype ?? '').toLowerCase();
        cb(null, mimetype.startsWith('image/'));
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB máximo antes da compressão (será comprimido para <2MB)
    }),
  )
  @UseFilters(MulterExceptionFilter)
  uploadPhoto(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { title?: string; localityId?: string },
    @CurrentUser() user: RbacUser,
  ) {
    return this.library.createPhoto(file, body, user);
  }

  @Put('photos/:id')
  @RequirePermission('library', 'update')
  updatePhoto(
    @Param('id') id: string,
    @Body()
    body: { title?: string; sortOrder?: number; localityId?: string | null },
    @CurrentUser() user: RbacUser,
  ) {
    return this.library.updatePhoto(id, body, user);
  }

  @Delete('photos/:id')
  @RequirePermission('library', 'delete')
  deletePhoto(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.library.deletePhoto(id, '', user);
  }

  @Post('documents/upload')
  @RequirePermission('library', 'create')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: libraryDocumentsDir,
        filename: (_req, file, cb) => {
          const extension = path.extname(file.originalname || '').toLowerCase();
          const safeExtension =
            extension && extension.length <= 10 ? extension : '.bin';
          cb(null, `${Date.now()}-${randomUUID()}${safeExtension}`);
        },
      }),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  @UseFilters(MulterExceptionFilter)
  uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { title?: string },
    @CurrentUser() user: RbacUser,
  ) {
    return this.library.createDocument(file, body, user);
  }

  @Put('documents/:id')
  @RequirePermission('library', 'update')
  updateDocument(
    @Param('id') id: string,
    @Body() body: { title?: string },
    @CurrentUser() user: RbacUser,
  ) {
    return this.library.updateDocument(id, body, user);
  }

  @Delete('documents/:id')
  @RequirePermission('library', 'delete')
  deleteDocument(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.library.deleteDocument(id, libraryDocumentsDir, user);
  }

  @Get('documents/:id/download')
  @RequirePermission('library', 'download')
  async downloadDocument(@Param('id') id: string, @Res() res: Response) {
    const document = await this.library.getDocumentById(id);
    const storageKey =
      String(document.storageKey ?? '').trim() ||
      path.basename(String(document.fileUrl ?? '').trim());
    const filePath = resolveExistingLibraryDocumentPath(storageKey);
    if (!filePath) {
      return res.status(404).json({
        message: 'Arquivo indisponível para download.',
        code: 'NOT_FOUND',
      });
    }
    res.setHeader('Cache-Control', 'private, no-store');
    return res.download(
      filePath,
      document.fileName || document.title || 'publicacao',
    );
  }
}
