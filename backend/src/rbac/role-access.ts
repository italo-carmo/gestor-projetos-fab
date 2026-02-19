import type { RbacUser } from './rbac.types';

export const ROLE_COORDENACAO_CIPAVD = 'Coordenação CIPAVD';
export const ROLE_COMANDANTE_COMGEP = 'Comandante COMGEP';
export const ROLE_TI = 'TI';
export const ROLE_GSD_LOCALIDADE = 'GSD Localidade';
export const ROLE_ADMIN_ESPECIALIDADE_LOCAL = 'Admin Especialidade Local';
export const ROLE_ADMIN_ESPECIALIDADE_NACIONAL = 'Admin Especialidade Nacional';
export const ROLE_ADMIN_LOCALIDADE = 'Admin Localidade';
export const ROLE_ADMINISTRACAO_LOCAL = 'Administração Local';

export function hasRole(user: RbacUser | undefined, roleName: string) {
  if (!user) return false;
  return user.roles.some((role) => role.name === roleName);
}

export function hasAnyRole(user: RbacUser | undefined, roleNames: string[]) {
  if (!user || roleNames.length === 0) return false;
  return user.roles.some((role) => roleNames.includes(role.name));
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
    localityId: user?.localityId ?? undefined,
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
