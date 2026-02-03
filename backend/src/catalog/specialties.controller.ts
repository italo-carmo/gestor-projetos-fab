import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeText } from '../common/sanitize';
import { CreateSpecialtyDto } from './dto/create-specialty.dto';
import { UpdateSpecialtyDto } from './dto/update-specialty.dto';

@Controller('specialties')
@UseGuards(JwtAuthGuard, RbacGuard)
export class SpecialtiesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('specialties', 'view')
  async list() {
    const items = await this.prisma.specialty.findMany({ orderBy: { name: 'asc' } });
    return { items };
  }

  @Post()
  @RequirePermission('specialties', 'create')
  async create(@Body() dto: CreateSpecialtyDto) {
    return this.prisma.specialty.create({
      data: {
        name: sanitizeText(dto.name),
        color: dto.color ? sanitizeText(dto.color) : null,
        icon: dto.icon ? sanitizeText(dto.icon) : null,
      },
    });
  }

  @Put(':id')
  @RequirePermission('specialties', 'update')
  async update(@Param('id') id: string, @Body() dto: UpdateSpecialtyDto) {
    return this.prisma.specialty.update({
      where: { id },
      data: {
        name: dto.name ? sanitizeText(dto.name) : undefined,
        color: dto.color ? sanitizeText(dto.color) : dto.color === null ? null : undefined,
        icon: dto.icon ? sanitizeText(dto.icon) : dto.icon === null ? null : undefined,
      },
    });
  }

  @Delete(':id')
  @RequirePermission('specialties', 'delete')
  async remove(@Param('id') id: string) {
    await this.prisma.specialty.delete({ where: { id } });
    return { ok: true };
  }
}
