import { can } from './rbac';

export const ROLE_COORDENACAO_CIPAVD = 'Coordenação CIPAVD';
export const ROLE_COMANDANTE_COMGEP = 'Comandante COMGEP';
export const ROLE_TI = 'TI';
export const ROLE_GSD_LOCALIDADE = 'GSD Localidade';

type MePayload = {
  roles?: Array<{ id?: string; name?: string }>;
  permissions?: Array<{ resource: string; action: string; scope?: string }>;
};

export function normalizeRoleName(roleName: string | null | undefined) {
  return String(roleName ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function hasRole(user: MePayload | undefined, roleName: string) {
  if (!user?.roles) return false;
  const expected = normalizeRoleName(roleName);
  return user.roles.some((role) => normalizeRoleName(role.name) === expected);
}

export function hasAnyRole(user: MePayload | undefined, roleNames: string[]) {
  if (!user || roleNames.length === 0) return false;
  return roleNames.some((roleName) => hasRole(user, roleName));
}

export function isNationalCommissionMember(user: MePayload | undefined) {
  return hasAnyRole(user, [
    ROLE_COORDENACAO_CIPAVD,
    ROLE_COMANDANTE_COMGEP,
  ]);
}

export function canEditRecruitsCount(
  user: (MePayload & { localityId?: string | null }) | undefined,
  targetLocalityId: string,
) {
  if (!user) return false;
  if (hasRole(user, ROLE_TI)) return true;
  if (isNationalCommissionMember(user)) return true;
  if (hasRole(user, ROLE_GSD_LOCALIDADE) && user.localityId === targetLocalityId) return true;
  return false;
}

export function resolveHomePath(user: MePayload | undefined) {
  if (isNationalCommissionMember(user)) return '/dashboard/national';
  if (can(user, 'task_instances', 'view')) return '/activities';
  return '/dashboard/executive';
}
