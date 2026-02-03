import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeText } from '../common/sanitize';
import { CreateLocalityDto } from './dto/create-locality.dto';
import { UpdateLocalityDto } from './dto/update-locality.dto';

@Controller('localities')
@UseGuards(JwtAuthGuard, RbacGuard)
export class LocalitiesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('localities', 'view')
  async list() {
    const items = await this.prisma.locality.findMany({ orderBy: { name: 'asc' } });
    return { items };
  }

  @Post()
  @RequirePermission('localities', 'create')
  async create(@Body() dto: CreateLocalityDto) {
    return this.prisma.locality.create({
      data: {
        code: sanitizeText(dto.code),
        name: sanitizeText(dto.name),
        commandName: dto.commandName ? sanitizeText(dto.commandName) : null,
        commanderName: dto.commanderName ? sanitizeText(dto.commanderName) : null,
        visitDate: dto.visitDate ? new Date(dto.visitDate) : null,
        recruitsFemaleCountCurrent: dto.recruitsFemaleCountCurrent ?? null,
        notes: dto.notes ? sanitizeText(dto.notes) : null,
      },
    });
  }

  @Put(':id')
  @RequirePermission('localities', 'update')
  async update(@Param('id') id: string, @Body() dto: UpdateLocalityDto) {
    return this.prisma.locality.update({
      where: { id },
      data: {
        code: dto.code ? sanitizeText(dto.code) : undefined,
        name: dto.name ? sanitizeText(dto.name) : undefined,
        commandName: dto.commandName ? sanitizeText(dto.commandName) : dto.commandName === null ? null : undefined,
        commanderName: dto.commanderName ? sanitizeText(dto.commanderName) : dto.commanderName === null ? null : undefined,
        visitDate: dto.visitDate ? new Date(dto.visitDate) : dto.visitDate === null ? null : undefined,
        recruitsFemaleCountCurrent: dto.recruitsFemaleCountCurrent ?? undefined,
        notes: dto.notes ? sanitizeText(dto.notes) : dto.notes === null ? null : undefined,
      },
    });
  }

  @Delete(':id')
  @RequirePermission('localities', 'delete')
  async remove(@Param('id') id: string) {
    await this.prisma.locality.delete({ where: { id } });
    return { ok: true };
  }
}
