import { can, canAccessAdminCatalog } from "./rbac";

export const ROLE_COORDENACAO_CIPAVD = "Coordenação CIPAVD";
export const ROLE_COMISSAO_CIPAVD = "Comissão CIPAVD";
export const ROLE_CIPAVD = "CIPAVD";
export const ROLE_COMGEP = "COMGEP";
export const ROLE_COMANDANTE_COMGEP = ROLE_COMGEP;
export const ROLE_TI = "TI";
export const ROLE_CPCA = "CPCA";
export const ROLE_GSD_LOCALIDADE = "GSD Localidade";
export const ROLE_ADM_MISSOES = "Adm Missões";

const COMGEP_ROLE_ALIASES = new Set(["comgep", "comandante comgep"]);

type MePayload = {
  roles?: Array<{ id?: string; name?: string }>;
  activeRole?: { id?: string; name?: string } | null;
  activeRoleId?: string | null;
  permissions?: Array<{ resource: string; action: string; scope?: string }>;
  executive_hide_pii?: boolean | null;
};

export function normalizeRoleName(roleName: string | null | undefined) {
  const normalized = String(roleName ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (COMGEP_ROLE_ALIASES.has(normalized)) return "comgep";
  return normalized;
}

export function canonicalRoleName(roleName: string | null | undefined) {
  const normalized = normalizeRoleName(roleName);
  if (normalized === "comgep") return ROLE_COMGEP;
  return String(roleName ?? "")
    .replace(/\s+/g, " ")
    .trim();
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

export function canAccessAdministration(user: MePayload | undefined) {
  if (hasRole(user, ROLE_ADM_MISSOES)) return false;
  return (
    canAccessAdminCatalog(user) || hasAnyRole(user, [ROLE_TI, ROLE_COMGEP])
  );
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
  if (
    hasAnyRole(user, [ROLE_TI, ROLE_COORDENACAO_CIPAVD, ROLE_COMISSAO_CIPAVD])
  )
    return true;
  // GSD pode editar apenas sua própria localidade
  if (
    hasRole(user, ROLE_GSD_LOCALIDADE) &&
    user.localityId === targetLocalityId
  )
    return true;
  return false;
}

export function resolveHomePath(user: MePayload | undefined) {
  const isCpcaProfile = hasRole(user, ROLE_CPCA);
  const canSeeStrategicDashboard = can(user, "strategic_dashboard", "view");
  const canSeeAi = can(user, "ai", "view");
  const canSeeSmifDashboard = can(user, "dashboard", "view", "NATIONAL");
  const canSeeCipavdDashboard =
    can(user, "dashboard", "view") &&
    (Boolean(user?.executive_hide_pii) || can(user, "roles", "view"));
  const canSeeCpcaDashboard = can(user, "cpca_dashboard", "view");
  const canSeeSocialCommunication = can(user, "social_communication", "view");
  const canSeeLibrary = can(user, "library", "view");
  const canSeeActivities = can(user, "task_instances", "view");
  const canSeeSmifComplaints = can(user, "smif_complaints", "view");
  const canSeeGsdRecruits =
    can(user, "localities", "view") || can(user, "dashboard", "view");
  const canSeeElos = can(user, "elos", "view");
  const canSeeBestPractices = can(user, "best_practices", "view");
  const canSeeMeetings = can(user, "meetings", "view");
  const canSeeOrgChart = can(user, "org_chart", "view");
  const canSeeGantt = can(user, "gantt", "view");
  const canSeeCalendar = can(user, "calendar", "view");
  const canSeeMissions = can(user, "missions", "view");
  const canSeeNotices = can(user, "notices", "view");
  const canSeeCpcaCases = can(user, "cpca_cases", "view");
  const canSeeCpcaCoverage = can(user, "cpca_coverage", "view");
  const canSeeOdgsaOms = can(user, "odgsa_oms", "view", "LOCALITY");
  const canSeeCpcaChecklist =
    can(user, "cpca_checklist", "view") &&
    hasAnyRole(user, [ROLE_TI, ROLE_COMGEP, ROLE_COORDENACAO_CIPAVD]);
  const canSeeCpcaPresidentApprovals =
    canSeeCpcaCases &&
    hasAnyRole(user, [
      ROLE_TI,
      ROLE_COMGEP,
      ROLE_COORDENACAO_CIPAVD,
      ROLE_CIPAVD,
    ]);
  const canSeeCpcaEmails =
    can(user, "cpca_emails", "view", "NATIONAL") &&
    hasAnyRole(user, [ROLE_TI, ROLE_COMGEP]);
  const canSeeAdminRbac =
    can(user, "users", "view") ||
    can(user, "roles", "view") ||
    can(user, "roles", "permissions");
  const canSeeAudit = can(user, "audit_logs", "view");
  const canSeeAdministration = canAccessAdministration(user);
  const canSeeOdgsaAdmin = can(user, "odgsa_admin", "view", "NATIONAL");

  if (isCpcaProfile) {
    const cpcaHomeCandidates: Array<[boolean, string]> = [
      [canSeeCpcaCases, "/cpca-cases"],
      [canSeeCpcaCases, "/cpca-commission"],
      [canSeeCpcaCoverage, "/cpca-coverage"],
      [canSeeCpcaChecklist, "/cpca-checklist"],
      [canSeeCpcaPresidentApprovals, "/cpca-president-approvals"],
    ];

    for (const [allowed, path] of cpcaHomeCandidates) {
      if (allowed) return path;
    }
  }

  const homeCandidates: Array<[boolean, string]> = [
    [canSeeStrategicDashboard, "/dashboard/estrategico"],
    [canSeeAi, "/ai"],
    [canSeeSmifDashboard, "/dashboard/smif"],
    [canSeeCipavdDashboard, "/dashboard/cipavd"],
    [canSeeCpcaDashboard, "/dashboard/cpca"],
    [canSeeSocialCommunication, "/social-communication"],
    [canSeeLibrary, "/library"],
    [canSeeActivities, "/activities"],
    [canSeeSmifComplaints, "/smif-complaints"],
    [canSeeGsdRecruits, "/gsd-recruits"],
    [canSeeElos, "/elos"],
    [canSeeBestPractices, "/best-practices"],
    [canSeeActivities, "/tasks"],
    [canSeeMeetings, "/meetings"],
    [canSeeOrgChart, "/org-chart"],
    [canSeeGantt, "/gantt"],
    [canSeeCalendar, "/calendar"],
    [canSeeMissions, "/missions"],
    [canSeeActivities, "/activities-cipavd"],
    [canSeeNotices, "/notices"],
    [canSeeAi, "/dashboard/bi"],
    [canSeeAi, "/dashboard/bi-violencia-domestica"],
    [
      canSeeAi && hasAnyRole(user, [ROLE_TI, ROLE_COMGEP]),
      "/dashboard/bi-recrutas",
    ],
    [canSeeAi, "/dashboard/bi-ciclo-boas-praticas"],
    [canSeeAi, "/dashboard/bi-encontro-cpca"],
    [canSeeAi, "/dashboard/bi-avaliacao-gsd"],
    [canSeeCpcaCases, "/cpca-cases"],
    [canSeeCpcaCases, "/cpca-commission"],
    [canSeeCpcaCoverage, "/cpca-coverage"],
    [canSeeCpcaChecklist, "/cpca-checklist"],
    [canSeeCpcaPresidentApprovals, "/cpca-president-approvals"],
    [canSeeCpcaEmails, "/cpca-emails"],
    [canSeeOdgsaOms, "/odgsa/oms"],
    [canSeeAdminRbac, "/admin/rbac"],
    [canSeeOdgsaAdmin, "/admin/odgsas"],
    [canSeeAudit, "/audit"],
    [canSeeAdministration, "/admin"],
  ];

  for (const [allowed, path] of homeCandidates) {
    if (allowed) return path;
  }

  if (can(user, "task_instances", "view")) return "/activities";
  return "/dashboard/cipavd";
}
