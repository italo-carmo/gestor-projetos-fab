import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { throwError } from '../common/http-error';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { isTiUser } from '../rbac/role-access';
import type { RbacUser } from '../rbac/rbac.types';
import { SettingsService } from './settings.service';
import { LitellmService } from '../llm/litellm.service';
import {
  AiKnowledgeSourceId,
  type AiAnalysisType,
  type AiProfileFeatureId,
} from '../ai/ai-knowledge-sources';
import type { ComgepScoringWeightKey } from './comgep-scoring';

@Controller('admin')
@UseGuards(JwtAuthGuard, RbacGuard)
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly litellm: LitellmService,
  ) {}

  @Get('ai-settings')
  @RequirePermission('admin_rbac', 'update')
  async getAiSettings() {
    return this.settings.getAiSettings();
  }

  @Put('ai-settings')
  @RequirePermission('admin_rbac', 'update')
  async updateAiSettings(
    @Body()
    body: {
      systemPrompt?: string;
      baseUrl?: string;
      apiKey?: string;
      model?: string;
      embeddingModel?: string;
      analysisPrompts?: Record<string, string>;
      analysisSources?: Partial<Record<string, AiKnowledgeSourceId[]>>;
      analysisKnowledgeBases?: Partial<Record<AiAnalysisType, string[]>>;
      analysisFeatures?: Partial<Record<AiAnalysisType, AiProfileFeatureId[]>>;
    },
  ) {
    await this.settings.updateAiSettings(body);
    return { ok: true };
  }

  @Get('ai-settings/test')
  @RequirePermission('admin_rbac', 'update')
  async testLitellmConnection() {
    return this.litellm.testConnection();
  }

  @Get('comgep-settings')
  @RequirePermission('admin_rbac', 'update')
  async getComgepSettings() {
    return this.settings.getComgepScoringSettings();
  }

  @Put('comgep-settings')
  @RequirePermission('admin_rbac', 'update')
  async updateComgepSettings(
    @Body()
    body: {
      weights?: Partial<Record<ComgepScoringWeightKey, number>>;
    },
  ) {
    await this.settings.updateComgepScoringSettings(body.weights ?? {});
    return { ok: true };
  }

  @Get('email-settings')
  @RequirePermission('admin_rbac', 'update')
  async getEmailSettings(@CurrentUser() user: RbacUser) {
    this.assertTiUser(user);
    return this.settings.getEmailSettings();
  }

  @Put('email-settings')
  @RequirePermission('admin_rbac', 'update')
  async updateEmailSettings(
    @CurrentUser() user: RbacUser,
    @Body()
    body: {
      cpcaPresidentSelfRegistrationRecipientEmail?: string | null;
    },
  ) {
    this.assertTiUser(user);
    await this.settings.updateEmailSettings(body);
    return { ok: true };
  }

  private assertTiUser(user: RbacUser | undefined) {
    if (!isTiUser(user)) {
      throwError('RBAC_FORBIDDEN');
    }
  }
}
