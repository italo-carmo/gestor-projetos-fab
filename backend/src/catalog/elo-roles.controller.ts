import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeText } from '../common/sanitize';
import { CreateEloRoleDto } from './dto/create-elo-role.dto';
import { UpdateEloRoleDto } from './dto/update-elo-role.dto';

@Controller('elo-roles')
@UseGuards(JwtAuthGuard, RbacGuard)
export class EloRolesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('elo_roles', 'view')
  async list() {
    const items = await this.prisma.eloRole.findMany({ orderBy: { sortOrder: 'asc' } });
    return { items };
  }

  @Post()
  @RequirePermission('elo_roles', 'create')
  async create(@Body() dto: CreateEloRoleDto) {
    return this.prisma.eloRole.create({
      data: {
        code: sanitizeText(dto.code).toUpperCase(),
        name: sanitizeText(dto.name),
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  @Put(':id')
  @RequirePermission('elo_roles', 'update')
  async update(@Param('id') id: string, @Body() dto: UpdateEloRoleDto) {
    return this.prisma.eloRole.update({
      where: { id },
      data: {
        code: dto.code ? sanitizeText(dto.code).toUpperCase() : undefined,
        name: dto.name ? sanitizeText(dto.name) : undefined,
        sortOrder: dto.sortOrder ?? undefined,
      },
    });
  }

  @Delete(':id')
  @RequirePermission('elo_roles', 'delete')
  async remove(@Param('id') id: string) {
    await this.prisma.eloRole.delete({ where: { id } });
    return { ok: true };
  }
}
