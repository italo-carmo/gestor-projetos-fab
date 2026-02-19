import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RbacGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission('users', 'view')
  async list() {
    const items = await this.users.list();
    return { items };
  }

  @Patch(':id')
  @RequirePermission('users', 'update')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, {
      eloRoleId: dto.eloRoleId,
      localityId: dto.localityId,
      roleId: dto.roleId,
    });
  }

  @Delete(':id/roles/:roleId')
  @RequirePermission('users', 'update')
  async removeRole(
    @Param('id') id: string,
    @Param('roleId') roleId: string,
  ) {
    return this.users.removeRole(id, roleId);
  }
}
