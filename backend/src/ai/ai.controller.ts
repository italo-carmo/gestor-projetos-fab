import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import type { RbacUser } from '../rbac/rbac.types';
import { AiAssistantService } from './ai-assistant.service';
import {
  AiService,
  AnalysisType,
  type ComgepCopilotMode,
  type ComgepCopilotFocus,
} from './ai.service';

@Controller('ai')
@UseGuards(JwtAuthGuard, RbacGuard)
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly assistant: AiAssistantService,
  ) {}

  private openSse(
    res: Response,
    initial?: { event: string; data: Record<string, unknown> },
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write(': connected\n\n');
    if (initial) {
      res.write(
        `event: ${initial.event}\ndata: ${JSON.stringify(initial.data)}\n\n`,
      );
    }
    (res as any).flush?.();
  }

  private writeSseChunk(res: Response, chunk: string) {
    res.write(chunk);
    (res as any).flush?.();
  }

  @Get('analyses')
  @RequirePermission('bi', 'view')
  listAnalyses() {
    return this.ai.getAnalysesCatalog();
  }

  @Get('action-agents')
  @RequirePermission('bi', 'view')
  listActionAgents() {
    return this.ai.getActionAgentsCatalog();
  }

  @Get('assistant/quick-actions')
  @RequirePermission('bi', 'view')
  listAssistantQuickActions() {
    return { items: this.assistant.listQuickActions() };
  }

  @Post('analyze')
  @RequirePermission('bi', 'view')
  async analyze(@Body() body: { type: AnalysisType }, @Res() res: Response) {
    this.openSse(res, {
      event: 'progress',
      data: { percent: 1, stage: 'Conexão estabelecida...' },
    });

    try {
      for await (const chunk of this.ai.analyzeStream(
        body.type ?? 'executive',
      )) {
        this.writeSseChunk(res, chunk);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.writeSseChunk(
        res,
        `event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`,
      );
    }
    res.end();
  }

  @Post('analyze/pdf')
  @RequirePermission('bi', 'view')
  async analyzePdf(
    @Body()
    body: {
      type: AnalysisType;
      narrative?: string;
      model?: string;
      generatedAt?: string;
    },
    @Res() res: Response,
  ) {
    const type = body.type ?? 'executive';
    const buffer = await this.ai.analysisPdf(type, {
      narrative: body.narrative,
      model: body.model,
      generatedAt: body.generatedAt,
    });
    const filename = `analise-ia-${type}-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Post('chat')
  @RequirePermission('bi', 'view')
  async chat(
    @Body()
    body: {
      message: string;
      history?: { role: string; content: string }[];
      analysisType?: AnalysisType;
    },
    @Res() res: Response,
  ) {
    this.openSse(res);

    const history = (body.history ?? []).map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

    try {
      for await (const chunk of this.ai.chatStream(
        body.message ?? '',
        history,
        body.analysisType,
      )) {
        this.writeSseChunk(res, chunk);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.writeSseChunk(
        res,
        `event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`,
      );
    }
    res.end();
  }

  @Post('action-agents/run')
  @RequirePermission('bi', 'view')
  async runActionAgent(
    @Body()
    body: {
      type: 'briefing_comgep' | 'priorizacao_intervencao' | 'governanca_cpca';
      uf?: string | null;
      mode?: ComgepCopilotMode | null;
      focus?: Partial<ComgepCopilotFocus> | null;
    },
    @Res() res: Response,
  ) {
    this.openSse(res, {
      event: 'progress',
      data: { percent: 1, stage: 'Conexão estabelecida com o copiloto...' },
    });

    try {
      for await (const chunk of this.ai.runActionAgentStream(body.type, {
        uf: body.uf,
        mode: body.mode,
        focus: body.focus,
      })) {
        this.writeSseChunk(res, chunk);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.writeSseChunk(
        res,
        `event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`,
      );
    }
    res.end();
  }

  @Post('action-agents/follow-up')
  @RequirePermission('bi', 'view')
  async followUpActionAgent(
    @Body()
    body: {
      sessionId: string;
      message: string;
      mode?: ComgepCopilotMode | null;
      focus?: Partial<ComgepCopilotFocus> | null;
    },
    @Res() res: Response,
  ) {
    this.openSse(res, {
      event: 'progress',
      data: { percent: 1, stage: 'Conexão estabelecida para follow-up...' },
    });

    try {
      for await (const chunk of this.ai.followUpActionAgentStream(body)) {
        this.writeSseChunk(res, chunk);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.writeSseChunk(
        res,
        `event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`,
      );
    }
    res.end();
  }

  @Post('action-agents/pdf')
  @RequirePermission('bi', 'view')
  async actionAgentPdf(
    @Body() body: { sessionId: string },
    @Res() res: Response,
  ) {
    const buffer = await this.ai.actionAgentSessionPdf(body.sessionId);
    const filename = `copiloto-comgep-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Post('assistant/message')
  @RequirePermission('bi', 'view')
  async assistantMessage(
    @Body()
    body: {
      sessionId?: string | null;
      message?: string | null;
      quickAction?:
        | 'create_mission'
        | 'create_activity'
        | 'create_task'
        | 'create_mission_schedule'
        | null;
      fieldInput?: { field?: string; value?: unknown } | null;
      confirmExecution?: boolean;
      cancelWorkflow?: boolean;
      skipCurrentField?: boolean;
    },
    @CurrentUser() user: RbacUser,
  ) {
    return this.assistant.handleMessage(body, user);
  }

  @Post('assistant/reset')
  @RequirePermission('bi', 'view')
  resetAssistantSession(@Body() body: { sessionId?: string | null }) {
    return this.assistant.resetSession(body.sessionId);
  }
}
