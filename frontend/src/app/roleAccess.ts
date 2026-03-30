import { can } from './rbac';

export const ROLE_COORDENACAO_CIPAVD = 'Coordenação CIPAVD';
export const ROLE_COMISSAO_CIPAVD = 'Comissão CIPAVD';
export const ROLE_CIPAVD = 'CIPAVD';
export const ROLE_COMGEP = 'COMGEP';
export const ROLE_COMANDANTE_COMGEP = ROLE_COMGEP;
export const ROLE_TI = 'TI';
export const ROLE_CPCA = 'CPCA';
export const ROLE_GSD_LOCALIDADE = 'GSD Localidade';

const COMGEP_ROLE_ALIASES = new Set(['comgep', 'comandante comgep']);

type MePayload = {
  roles?: Array<{ id?: string; name?: string }>;
  activeRole?: { id?: string; name?: string } | null;
  activeRoleId?: string | null;
  permissions?: Array<{ resource: string; action: string; scope?: string }>;
};

export function normalizeRoleName(roleName: string | null | undefined) {
  const normalized = String(roleName ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (COMGEP_ROLE_ALIASES.has(normalized)) return 'comgep';
  return normalized;
}

export function canonicalRoleName(roleName: string | null | undefined) {
  const normalized = normalizeRoleName(roleName);
  if (normalized === 'comgep') return ROLE_COMGEP;
  return String(roleName ?? '').replace(/\s+/g, ' ').trim();
}

export function hasRole(user: MePayload | undefined, roleName: string) {
  const expected = normalizeRoleName(roleName);
  const activeRoleName = user?.activeRole?.name;
  if (activeRoleName) {
    return normalizeRoleName(activeRoleName) === expected;
  }
  if (!user?.roles) return false;
  return user.roles.some((role) => normalizeRoleName(role.name) === expected);
}

export function hasAnyRole(user: MePayload | undefined, roleNames: string[]) {
  if (!user || roleNames.length === 0) return false;
  return roleNames.some((roleName) => hasRole(user, roleName));
}

export function isNationalCommissionMember(user: MePayload | undefined) {
  return hasAnyRole(user, [
    ROLE_COORDENACAO_CIPAVD,
    ROLE_COMISSAO_CIPAVD,
    ROLE_COMANDANTE_COMGEP,
  ]);
}

export function hasNationalManagementScope(user: MePayload | undefined) {
  return hasRole(user, ROLE_TI) || isNationalCommissionMember(user);
}

export function canEditRecruitsCount(
  user: (MePayload & { localityId?: string | null }) | undefined,
  targetLocalityId: string,
) {
  if (!user) return false;
  // TI e Coordenação CIPAVD podem editar qualquer localidade
  if (hasAnyRole(user, [ROLE_TI, ROLE_COORDENACAO_CIPAVD, ROLE_COMISSAO_CIPAVD]))
    return true;
  // GSD pode editar apenas sua própria localidade
  if (hasRole(user, ROLE_GSD_LOCALIDADE) && user.localityId === targetLocalityId) return true;
  return false;
}

export function resolveHomePath(user: MePayload | undefined) {
  if (hasRole(user, ROLE_CIPAVD)) return '/dashboard/cipavd';
  if (hasNationalManagementScope(user)) return '/dashboard/smif';
  if (can(user, 'cpca_cases', 'view')) return '/cpca-cases';
  if (can(user, 'task_instances', 'view')) return '/activities';
  return '/dashboard/cipavd';
}
