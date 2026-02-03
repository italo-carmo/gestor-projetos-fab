import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import fs from 'node:fs';
import path from 'node:path';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async health() {
    const db = await this.checkDb();
    const storage = this.checkStorage();
    return {
      status: db.ok && storage.ok ? 'ok' : 'degraded',
      db,
      storage,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDb() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }

  private checkStorage() {
    try {
      const dir = path.resolve(process.cwd(), 'storage', 'reports');
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }
}

