import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import type { RbacUser } from '../rbac/rbac.types';
import { MulterExceptionFilter } from '../reports/multer-exception.filter';
import { LibraryService } from './library.service';

export const libraryPhotosDir = path.resolve(
  process.cwd(),
  'storage',
  'library-photos',
);
export const libraryDocumentsDir = path.resolve(
  process.cwd(),
  'storage',
  'library-documents',
);

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
  list() {
    return this.library.getData();
  }

  @Put('settings')
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
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: libraryPhotosDir,
        filename: (_req, file, cb) => {
          const extension = path.extname(file.originalname || '').toLowerCase();
          const safeExtension = extension && extension.length <= 10 ? extension : '.jpg';
          cb(null, `${Date.now()}-${randomUUID()}${safeExtension}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const mimetype = String(file.mimetype ?? '').toLowerCase();
        cb(null, mimetype.startsWith('image/'));
      },
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  @UseFilters(MulterExceptionFilter)
  uploadPhoto(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { title?: string },
    @CurrentUser() user: RbacUser,
  ) {
    return this.library.createPhoto(file, body, user);
  }

  @Put('photos/:id')
  updatePhoto(
    @Param('id') id: string,
    @Body() body: { title?: string; sortOrder?: number },
    @CurrentUser() user: RbacUser,
  ) {
    return this.library.updatePhoto(id, body, user);
  }

  @Delete('photos/:id')
  deletePhoto(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.library.deletePhoto(id, libraryPhotosDir, user);
  }

  @Post('documents/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: libraryDocumentsDir,
        filename: (_req, file, cb) => {
          const extension = path.extname(file.originalname || '').toLowerCase();
          const safeExtension = extension && extension.length <= 10 ? extension : '.bin';
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
  updateDocument(
    @Param('id') id: string,
    @Body() body: { title?: string },
    @CurrentUser() user: RbacUser,
  ) {
    return this.library.updateDocument(id, body, user);
  }

  @Delete('documents/:id')
  deleteDocument(@Param('id') id: string, @CurrentUser() user: RbacUser) {
    return this.library.deleteDocument(id, libraryDocumentsDir, user);
  }
}

