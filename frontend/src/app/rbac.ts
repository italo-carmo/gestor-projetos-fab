export type Permission = { resource: string; action: string; scope?: string };

export function can(
  user: { permissions?: Permission[] } | undefined,
  resource: string,
  action: string,
  scope?: string,
) {
  if (!user?.permissions) return false;
  return user.permissions.some((perm) => {
    const resourceOk = perm.resource === resource || perm.resource === '*';
    const actionOk = perm.action === action || perm.action === '*';
    const scopeOk = !scope || perm.scope === scope;
    return resourceOk && actionOk && scopeOk;
  });
}
