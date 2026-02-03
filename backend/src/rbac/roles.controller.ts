import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermission } from './require-permission.decorator';
import { RbacGuard } from './rbac.guard';
import { RbacService } from './rbac.service';
import { RoleDto } from './dto/role.dto';
import { RolePermissionsDto } from './dto/role-permissions.dto';

@Controller('roles')
@UseGuards(JwtAuthGuard, RbacGuard)
export class RolesController {
  constructor(private readonly rbac: RbacService) {}

  @Get()
  @RequirePermission('roles', 'view')
  async list() {
    const roles = await this.rbac.listRoles();
    return { items: roles };
  }

  @Post()
  @RequirePermission('roles', 'create')
  create(@Body() dto: RoleDto) {
    return this.rbac.createRole({
      name: dto.name,
      description: dto.description ?? null,
      isSystemRole: dto.isSystemRole ?? false,
      wildcard: dto.wildcard ?? false,
    });
  }

  @Put(':id')
  @RequirePermission('roles', 'update')
  update(@Param('id') id: string, @Body() dto: RoleDto) {
    return this.rbac.updateRole(id, {
      name: dto.name,
      description: dto.description ?? null,
      isSystemRole: dto.isSystemRole ?? undefined,
      wildcard: dto.wildcard ?? undefined,
    });
  }

  @Delete(':id')
  @RequirePermission('roles', 'delete')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.rbac.deleteRole(id);
  }

  @Post(':id/clone')
  @RequirePermission('roles', 'clone')
  clone(@Param('id') id: string, @Body() body?: { name?: string; description?: string }) {
    return this.rbac.cloneRole(id, body?.name, body?.description);
  }

  @Put(':id/permissions')
  @RequirePermission('roles', 'permissions')
  setPermissions(@Param('id') id: string, @Body() dto: RolePermissionsDto) {
    return this.rbac.setRolePermissions(id, dto.permissions as any);
  }
}
