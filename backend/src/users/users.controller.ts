import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { throwError } from '../common/http-error';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { isTiUser } from '../rbac/role-access';
import type { RbacUser } from '../rbac/rbac.types';
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
      omId: dto.omId,
      localityId: dto.localityId,
      specialtyId: dto.specialtyId,
      roleId: dto.roleId,
      roleIds: dto.roleIds,
    });
  }

  @Delete(':id/roles/:roleId')
  @RequirePermission('users', 'update')
  async removeRole(@Param('id') id: string, @Param('roleId') roleId: string) {
    return this.users.removeRole(id, roleId);
  }

  @Delete(':id')
  @RequirePermission('users', 'update')
  async deleteUserAccess(
    @Param('id') id: string,
    @CurrentUser() user: RbacUser,
  ) {
    if (!isTiUser(user)) {
      throwError('RBAC_FORBIDDEN');
    }
    if (String(user?.id ?? '').trim() === String(id ?? '').trim()) {
      throwError('VALIDATION_ERROR', { reason: 'USER_CANNOT_DELETE_SELF' });
    }
    return this.users.deleteUserAccessAndPresidentHistory(id);
  }
}
