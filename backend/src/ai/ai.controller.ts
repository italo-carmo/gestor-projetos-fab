import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { PermissionScope } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import type { RbacUser } from '../rbac/rbac.types';
import { AiAssistantService } from './ai-assistant.service';
import {
  AiService,
  AnalysisType,
  type ChatProfileType,
  type ComgepCopilotIntent,
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
  @RequirePermission('ai', 'view', PermissionScope.NATIONAL)
  listAnalyses() {
    return this.ai.getAnalysesCatalog();
  }

  @Get('action-agents')
  @RequirePermission('ai', 'view', PermissionScope.NATIONAL)
  listActionAgents() {
    return this.ai.getActionAgentsCatalog();
  }

  @Get('assistant/quick-actions')
  @RequirePermission('ai', 'view', PermissionScope.NATIONAL)
  listAssistantQuickActions() {
    return { items: this.assistant.listQuickActions() };
  }

  @Post('analyze')
  @RequirePermission('ai', 'view', PermissionScope.NATIONAL)
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
  @RequirePermission('ai', 'view', PermissionScope.NATIONAL)
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
  @RequirePermission('ai', 'view', PermissionScope.NATIONAL)
  async chat(
    @Body()
    body: {
      message: string;
      history?: { role: string; content: string }[];
      analysisType?: AnalysisType | 'chatbot';
      profile?: ChatProfileType;
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
        body.profile ?? body.analysisType,
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
  @RequirePermission('ai', 'view', PermissionScope.NATIONAL)
  async runActionAgent(
    @Body()
    body: {
      type: 'briefing_comgep' | 'priorizacao_intervencao' | 'governanca_cpca';
      uf?: string | null;
      mode?: ComgepCopilotMode | null;
      intent?: ComgepCopilotIntent | null;
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
        intent: body.intent,
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
  @RequirePermission('ai', 'view', PermissionScope.NATIONAL)
  async followUpActionAgent(
    @Body()
    body: {
      sessionId: string;
      message: string;
      mode?: ComgepCopilotMode | null;
      intent?: ComgepCopilotIntent | null;
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
  @RequirePermission('ai', 'view', PermissionScope.NATIONAL)
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
  @RequirePermission('ai', 'view', PermissionScope.NATIONAL)
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
        | 'create_social_article'
        | 'create_report'
        | null;
      contextSeed?:
        | {
            source?: string | null;
            title?: string | null;
            description?: string | null;
            suggestedScope?: string | null;
            uf?: string | null;
            omId?: string | null;
            omLabel?: string | null;
            recommendedAction?: string | null;
          }
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

  @Post('assistant/upload')
  @RequirePermission('ai', 'view', PermissionScope.NATIONAL)
  @UseInterceptors(
    FilesInterceptor('files', 6, {
      limits: { fileSize: 12 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const mimetype = String(file.mimetype ?? '').toLowerCase();
        cb(
          null,
          mimetype === 'application/pdf' || mimetype.startsWith('image/'),
        );
      },
    }),
  )
  async assistantUpload(
    @Body() body: { sessionId?: string | null },
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: RbacUser,
  ) {
    return this.assistant.handleUpload(
      { sessionId: body.sessionId, files: files ?? [] },
      user,
    );
  }

  @Post('assistant/reset')
  @RequirePermission('ai', 'view', PermissionScope.NATIONAL)
  resetAssistantSession(@Body() body: { sessionId?: string | null }) {
    return this.assistant.resetSession(body.sessionId);
  }

  @Post('assistant/report/pdf')
  @RequirePermission('ai', 'view', PermissionScope.NATIONAL)
  async assistantReportPdf(
    @Body() body: { sessionId?: string | null },
    @CurrentUser() user: RbacUser,
    @Res() res: Response,
  ) {
    const result = await this.assistant.buildReportPdfForSession(
      body.sessionId,
      user,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Content-Length': result.buffer.length,
    });
    res.end(result.buffer);
  }
}
