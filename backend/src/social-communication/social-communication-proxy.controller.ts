import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SocialCommunicationService } from './social-communication.service';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { throwError } from '../common/http-error';
import { getSocialCommunicationCoverCandidates } from './social-communication-storage';

@Controller('social-communication/proxy')
export class SocialCommunicationProxyController {
  constructor(
    private readonly socialCommunication: SocialCommunicationService,
  ) {}

  @Get('content')
  async content(
    @Query('articleId') articleId: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ) {
    const payload = await this.socialCommunication.getPublicContent(
      articleId,
      exp,
      sig,
    );
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=600');
    return res.send(payload.html);
  }

  @Get('cover')
  async cover(
    @Query('articleId') articleId: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ) {
    const payload = await this.socialCommunication.getPublicCover(
      articleId,
      exp,
      sig,
    );
    res.setHeader('Content-Type', payload.contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(payload.buffer);
  }

  @Get('asset')
  async asset(
    @Query('url') url: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ) {
    const payload = await this.socialCommunication.getPublicAsset(
      url,
      exp,
      sig,
    );
    res.setHeader('Content-Type', payload.contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(payload.buffer);
  }

  @Get('page')
  async page(
    @Query('url') url: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ) {
    const payload = await this.socialCommunication.getPublicPage(url, exp, sig);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=600');
    return res.send(payload.html);
  }

}

@Controller('social-communication/uploads')
export class SocialCommunicationUploadsController {
  @Get(':filename')
  async uploadedCover(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = path.basename(String(filename ?? ''));
    if (!safeName || safeName !== filename) throwError('NOT_FOUND');
    const filePath = getSocialCommunicationCoverCandidates(safeName).find((candidate) =>
      fs.existsSync(candidate),
    );
    if (!filePath) throwError('NOT_FOUND');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.sendFile(filePath);
  }
}
