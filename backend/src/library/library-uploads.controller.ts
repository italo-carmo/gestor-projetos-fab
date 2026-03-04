import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { throwError } from '../common/http-error';
import { libraryDocumentsDir, libraryPhotosDir } from './library.controller';

@Controller('library/uploads')
export class LibraryUploadsController {
  @Get('photos/:filename')
  sendPhoto(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = path.basename(String(filename ?? '').trim());
    const filePath = path.join(libraryPhotosDir, safeName);
    if (!safeName || !fs.existsSync(filePath)) {
      throwError('NOT_FOUND');
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.sendFile(filePath);
  }

  @Get('documents/:filename')
  sendDocument(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = path.basename(String(filename ?? '').trim());
    const filePath = path.join(libraryDocumentsDir, safeName);
    if (!safeName || !fs.existsSync(filePath)) {
      throwError('NOT_FOUND');
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.sendFile(filePath);
  }
}

