import type { RbacUser } from './rbac.types';

export const ROLE_COORDENACAO_CIPAVD = 'Coordenação CIPAVD';
export const ROLE_COMANDANTE_COMGEP = 'Comandante COMGEP';
export const ROLE_TI = 'TI';
export const ROLE_GSD_LOCALIDADE = 'GSD Localidade';
export const ROLE_ADMIN_ESPECIALIDADE_LOCAL = 'Admin Especialidade Local';
export const ROLE_ADMIN_ESPECIALIDADE_NACIONAL = 'Admin Especialidade Nacional';
export const ROLE_ADMIN_LOCALIDADE = 'Admin Localidade';
export const ROLE_ADMINISTRACAO_LOCAL = 'Administração Local';

export function normalizeRoleName(roleName: string | null | undefined) {
  return String(roleName ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function hasRole(user: RbacUser | undefined, roleName: string) {
  if (!user) return false;
  const expected = normalizeRoleName(roleName);
  return user.roles.some((role) => normalizeRoleName(role.name) === expected);
}

export function hasAnyRole(user: RbacUser | undefined, roleNames: string[]) {
  if (!user || roleNames.length === 0) return false;
  return roleNames.some((roleName) => hasRole(user, roleName));
}

export function isNationalCommissionMember(user: RbacUser | undefined) {
  return hasAnyRole(user, [
    ROLE_COORDENACAO_CIPAVD,
    ROLE_COMANDANTE_COMGEP,
  ]);
}

export function isTiUser(user: RbacUser | undefined) {
  return hasRole(user, ROLE_TI);
}

export function isLocalityAdmin(user: RbacUser | undefined) {
  return hasAnyRole(user, [
    ROLE_GSD_LOCALIDADE,
    ROLE_ADMIN_LOCALIDADE,
    ROLE_ADMINISTRACAO_LOCAL,
  ]);
}

export function isSpecialtyAdmin(user: RbacUser | undefined) {
  if (!user) return false;
  if (hasAnyRole(user, [ROLE_ADMIN_ESPECIALIDADE_LOCAL, ROLE_ADMIN_ESPECIALIDADE_NACIONAL])) {
    return true;
  }
  return user.roles.some((role) => role.name.toLowerCase().includes('admin especialidade'));
}

export function isNationalSpecialtyAdmin(user: RbacUser | undefined) {
  return isSpecialtyAdmin(user) && !user?.localityId;
}

export function isLocalSpecialtyAdmin(user: RbacUser | undefined) {
  return isSpecialtyAdmin(user) && Boolean(user?.localityId);
}

export function resolveAccessProfile(user: RbacUser | undefined) {
  const ti = isTiUser(user);
  const nationalCommission = isNationalCommissionMember(user);
  const effectiveLocalityId = ti || nationalCommission ? undefined : user?.localityId ?? undefined;
  const localityAdmin = isLocalityAdmin(user);
  const specialtyAdmin = isSpecialtyAdmin(user);
  const nationalSpecialtyAdmin = isNationalSpecialtyAdmin(user);
  const localSpecialtyAdmin = isLocalSpecialtyAdmin(user);

  return {
    ti,
    nationalCommission,
    localityAdmin,
    specialtyAdmin,
    nationalSpecialtyAdmin,
    localSpecialtyAdmin,
    // Users tied to a specialty can represent group-admin scope either by specialtyId or eloRoleId.
    groupSpecialtyId: user?.specialtyId ?? undefined,
    groupEloRoleId: user?.eloRoleId ?? undefined,
    localityId: effectiveLocalityId,
    isAdminLike:
      ti ||
      nationalCommission ||
      localityAdmin ||
      specialtyAdmin,
  };
}

export function canEditRecruitsByRole(
  user: RbacUser | undefined,
  targetLocalityId: string,
) {
  if (!user) return false;
  if (hasRole(user, ROLE_TI)) return true;
  if (isNationalCommissionMember(user)) return true;
  if (hasRole(user, ROLE_GSD_LOCALIDADE) && user.localityId === targetLocalityId) {
    return true;
  }
  return false;
}
