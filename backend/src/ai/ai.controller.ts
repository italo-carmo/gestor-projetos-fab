import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { AiService, AnalysisType } from './ai.service';

@Controller('ai')
@UseGuards(JwtAuthGuard, RbacGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('analyses')
  @RequirePermission('bi', 'view')
  listAnalyses() {
    return this.ai.getAnalysesCatalog();
  }

  @Post('analyze')
  @RequirePermission('bi', 'view')
  async analyze(
    @Body() body: { type: AnalysisType },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      for await (const chunk of this.ai.analyzeStream(body.type ?? 'executive')) {
        res.write(chunk);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.write(`event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`);
    }
    res.end();
  }

  @Post('chat')
  @RequirePermission('bi', 'view')
  async chat(
    @Body() body: { message: string; history?: { role: string; content: string }[] },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const history = (body.history ?? []).map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

    try {
      for await (const chunk of this.ai.chatStream(body.message ?? '', history)) {
        res.write(chunk);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.write(`event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`);
    }
    res.end();
  }
}
