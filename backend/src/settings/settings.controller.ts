import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { SettingsService } from './settings.service';
import { LitellmService } from '../llm/litellm.service';

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
      analysisPrompts?: Record<string, string>;
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
}
