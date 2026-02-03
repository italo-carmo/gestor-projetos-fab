import { SetMetadata } from '@nestjs/common';
import { PermissionRequirement } from './rbac.types';

export const PERMISSION_METADATA_KEY = 'rbac:permission';

export function RequirePermission(resource: string, action: string, scope?: string) {
  const requirement: PermissionRequirement = { resource, action, scope };
  return SetMetadata(PERMISSION_METADATA_KEY, requirement);
}
