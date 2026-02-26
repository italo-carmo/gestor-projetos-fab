import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SocialCommunicationService } from './social-communication.service';

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
