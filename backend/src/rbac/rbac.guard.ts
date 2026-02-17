import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_METADATA_KEY } from './require-permission.decorator';
import { RbacService } from './rbac.service';
import { throwError } from '../common/http-error';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly rbac: RbacService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.get(PERMISSION_METADATA_KEY, context.getHandler());
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId as string | undefined;

    if (!userId) {
      throwError('RBAC_FORBIDDEN');
    }

    const access = await this.rbac.getUserAccess(userId);
    request.rbacUser = access;

    if (!requirement) {
      return true;
    }

    const { resource, action, scope } = requirement;

    const allowed = access.permissions.some((perm) => {
      if (perm.resource !== resource && perm.resource !== '*') return false;
      if (perm.action !== action && perm.action !== '*') return false;
      if (scope && perm.scope !== scope) return false;
      return true;
    });

    if (!allowed) {
      const wildcard = access.roles.some((role) => role.wildcard);
      if (wildcard) {
        const blockedByOverride = access.moduleAccessOverrides.some(
          (override) => override.resource === resource && !override.enabled,
        );
        if (!blockedByOverride) {
          return true;
        }
      }
      throwError('RBAC_FORBIDDEN');
    }

    return true;
  }
}
