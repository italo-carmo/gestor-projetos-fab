export type Permission = { resource: string; action: string; scope?: string };
type RbacUser = { permissions?: Permission[] } | undefined;

export function can(
  user: RbacUser,
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

export function canAccessAdminCatalog(user: RbacUser) {
  return (
    can(user, "localities", "create") ||
    can(user, "localities", "update") ||
    can(user, "localities", "delete") ||
    can(user, "specialties", "create") ||
    can(user, "specialties", "update") ||
    can(user, "specialties", "delete") ||
    can(user, "postos", "create") ||
    can(user, "postos", "update") ||
    can(user, "postos", "delete") ||
    can(user, "phases", "update") ||
    can(user, "elo_roles", "create") ||
    can(user, "elo_roles", "update") ||
    can(user, "elo_roles", "delete") ||
    can(user, "missions", "update")
  );
}
