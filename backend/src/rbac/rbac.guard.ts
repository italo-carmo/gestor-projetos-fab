import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_METADATA_KEY } from './require-permission.decorator';
import { RbacService } from './rbac.service';
import { throwError } from '../common/http-error';
import { normalizeRoleName, ROLE_TI } from './role-access';

@Injectable()
export class RbacGuard implements CanActivate {
  private readonly tiRoleNameNormalized = normalizeRoleName(ROLE_TI);

  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.get(
      PERMISSION_METADATA_KEY,
      context.getHandler(),
    );
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId as string | undefined;

    if (!userId) {
      throwError('RBAC_FORBIDDEN');
    }

    const requestedRoleHeader = request.headers?.['x-active-role-id'];
    const requestedRoleId = Array.isArray(requestedRoleHeader)
      ? String(requestedRoleHeader[0] ?? '').trim()
      : String(requestedRoleHeader ?? '').trim();
    const access = await this.rbac.getUserAccess(
      userId,
      requestedRoleId || undefined,
    );
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
      const hasTiRole = (access.allRoles ?? access.roles ?? []).some(
        (role) =>
          normalizeRoleName(role?.name) === this.tiRoleNameNormalized,
      );
      const isTiBlockedAction =
        resource === 'audit_logs' && action === 'delete';
      if (hasTiRole && !isTiBlockedAction) {
        return true;
      }
      throwError('RBAC_FORBIDDEN');
    }

    return true;
  }
}
