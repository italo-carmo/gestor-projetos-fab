import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeText } from '../common/sanitize';
import { CreatePostoDto } from './dto/create-posto.dto';
import { UpdatePostoDto } from './dto/update-posto.dto';

@Controller('postos')
@UseGuards(JwtAuthGuard, RbacGuard)
export class PostosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('postos', 'view')
  async list() {
    const items = await this.prisma.posto.findMany({ orderBy: { sortOrder: 'asc' } });
    return { items };
  }

  @Post()
  @RequirePermission('postos', 'create')
  async create(@Body() dto: CreatePostoDto) {
    return this.prisma.posto.create({
      data: {
        code: sanitizeText(dto.code).toUpperCase(),
        name: sanitizeText(dto.name),
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  @Put(':id')
  @RequirePermission('postos', 'update')
  async update(@Param('id') id: string, @Body() dto: UpdatePostoDto) {
    return this.prisma.posto.update({
      where: { id },
      data: {
        code: dto.code ? sanitizeText(dto.code).toUpperCase() : undefined,
        name: dto.name ? sanitizeText(dto.name) : undefined,
        sortOrder: dto.sortOrder ?? undefined,
      },
    });
  }

  @Delete(':id')
  @RequirePermission('postos', 'delete')
  async remove(@Param('id') id: string) {
    await this.prisma.posto.delete({ where: { id } });
    return { ok: true };
  }
}
