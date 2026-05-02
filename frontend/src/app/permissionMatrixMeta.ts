export type PermissionResourceMeta = {
  menu: string;
  menuOrder: number;
  title: string;
  description: string;
  route?: string;
  routeAliases?: string[];
  sidebarItems?: string[];
  expectedActions?: string[];
};

const VIEW_ONLY = ["view"];
const VIEW_UPDATE = ["view", "update"];
const VIEW_CREATE = ["view", "create"];
const CRUD = ["view", "create", "update", "delete"];
const CRUD_DOWNLOAD = ["view", "create", "update", "delete", "download"];
const CRUD_UPLOAD = ["view", "create", "update", "delete", "upload"];
const CRUD_COMMENT = ["view", "create", "update", "delete", "comment"];

const RESOURCE_META: Record<string, PermissionResourceMeta> = {
  dashboard: {
    menu: "Dashboards",
    menuOrder: 10,
    title: "Dashboards",
    description: "Visualização e ajustes dos paineis executivos e CIPAVD.",
    route: "/dashboard/smif",
    routeAliases: ["/dashboard/cipavd", "/dashboard/locality/:id"],
    sidebarItems: ["SMIF", "CIPAVD"],
    expectedActions: VIEW_UPDATE,
  },
  strategic_dashboard: {
    menu: "Dashboards",
    menuOrder: 10,
    title: "Painel Estratégico",
    description:
      "Leitura executiva, territorial e prioritária do panorama institucional.",
    route: "/dashboard/estrategico",
    routeAliases: ["/dashboard/comgep"],
    sidebarItems: ["Painel Estratégico"],
    expectedActions: VIEW_ONLY,
  },
  ai: {
    menu: "Dashboards",
    menuOrder: 10,
    title: "Inteligência Artificial",
    description: "Assistentes, análises, copilotos e fluxos assistidos por IA.",
    route: "/ai",
    routeAliases: ["/cpca-ai"],
    sidebarItems: ["Inteligência Artificial", "IA CPCA"],
    expectedActions: VIEW_ONLY,
  },
  kpis: {
    menu: "Dashboards",
    menuOrder: 10,
    title: "KPIs",
    description: "Cadastro e manutencao de indicadores exibidos nos paineis.",
    route: "/dashboard/cipavd",
    sidebarItems: ["CIPAVD"],
    expectedActions: VIEW_CREATE,
  },
  gantt: {
    menu: "Planejamento",
    menuOrder: 20,
    title: "Gantt",
    description: "Acesso ao cronograma visual de tarefas e fases.",
    route: "/gantt",
    sidebarItems: ["Cronograma"],
    expectedActions: VIEW_ONLY,
  },
  calendar: {
    menu: "Planejamento",
    menuOrder: 20,
    title: "Calendario",
    description: "Acesso ao calendario consolidado de compromissos.",
    route: "/calendar",
    sidebarItems: ["Calendario"],
    expectedActions: VIEW_ONLY,
  },
  meetings: {
    menu: "Planejamento",
    menuOrder: 20,
    title: "Reunioes",
    description: "Gestao de reunioes, decisoes, participantes e vinculos.",
    route: "/meetings",
    sidebarItems: ["Reunioes"],
    expectedActions: CRUD,
  },
  tasks: {
    menu: "Planejamento",
    menuOrder: 20,
    title: "Tarefas de Reuniao",
    description: "Acoes especiais de tarefas geradas a partir de reunioes.",
    route: "/meetings",
    sidebarItems: ["Reunioes"],
    expectedActions: ["generate_from_meeting"],
  },
  task_instances: {
    menu: "Planejamento",
    menuOrder: 20,
    title: "Tarefas",
    description:
      "Gestao das tarefas e atividades de campo executadas nas OMs e na CIPAVD.",
    route: "/activities",
    routeAliases: ["/activities-cipavd", "/tasks"],
    sidebarItems: ["Tarefas", "Atividades de Campo"],
    expectedActions: ["view", "create", "update", "delete", "assign", "export"],
  },
  task_templates: {
    menu: "Planejamento",
    menuOrder: 20,
    title: "Templates de Tarefas",
    description: "Modelos para criacao e padronizacao de tarefas.",
    route: "/templates",
    sidebarItems: ["Administração"],
    expectedActions: ["view", "create", "update"],
  },
  checklists: {
    menu: "Planejamento",
    menuOrder: 20,
    title: "Checklists",
    description: "Controle de checklists por fase, OM e especialidade.",
    route: "/checklists",
    sidebarItems: ["Checklists"],
    expectedActions: ["view", "create", "update", "export"],
  },
  phases: {
    menu: "Planejamento",
    menuOrder: 20,
    title: "Fases",
    description: "Gestao das fases usadas em tarefas e checklists.",
    route: "/admin?tab=phases",
    routeAliases: ["/admin/phases"],
    sidebarItems: ["Administracao"],
    expectedActions: VIEW_UPDATE,
  },
  missions: {
    menu: "Operacoes",
    menuOrder: 30,
    title: "Missoes",
    description: "Fluxos de missao, participantes, agenda e checklist.",
    route: "/missions",
    sidebarItems: ["Missoes"],
    expectedActions: [
      "view",
      "create",
      "update",
      "delete",
      "upload",
      "download",
    ],
  },
  reports: {
    menu: "Operacoes",
    menuOrder: 30,
    title: "Relatorios",
    description: "Upload, aprovacao e download de relatorios operacionais.",
    route: "/tasks",
    sidebarItems: ["Atividades de Campo", "Tarefas"],
    expectedActions: ["create", "update", "upload", "approve", "download"],
  },
  notices: {
    menu: "Comunicacao",
    menuOrder: 40,
    title: "Avisos",
    description: "Publicacao e fixacao de avisos institucionais.",
    route: "/notices",
    sidebarItems: ["Avisos"],
    expectedActions: ["view", "create", "update", "delete", "pin"],
  },
  documents: {
    menu: "Comunicacao",
    menuOrder: 40,
    title: "Documentos",
    description: "Estrutura de documentos, links e subcategorias.",
    route: "/documents",
    sidebarItems: ["Documentos"],
    expectedActions: CRUD_DOWNLOAD,
  },
  social_communication: {
    menu: "Comunicacao",
    menuOrder: 40,
    title: "Comunicacao Social",
    description: "Gestao de comunicados e cards de comunicacao social.",
    route: "/social-communication",
    sidebarItems: ["Impacto Positivo"],
    expectedActions: CRUD_UPLOAD,
  },
  social_communication_highlight: {
    menu: "Comunicacao",
    menuOrder: 40,
    title: "Destaques de Comunicacao",
    description: "Painel de destaques usados na comunicacao social.",
    route: "/social-communication",
    sidebarItems: ["Impacto Positivo"],
    expectedActions: CRUD,
  },
  library: {
    menu: "Comunicacao",
    menuOrder: 40,
    title: "Biblioteca",
    description: "Fotos, documentos e configuracoes da biblioteca.",
    route: "/library",
    sidebarItems: ["Biblioteca"],
    expectedActions: CRUD_DOWNLOAD,
  },
  best_practices: {
    menu: "Conhecimento",
    menuOrder: 50,
    title: "Boas Praticas",
    description: "Publicacoes e curadoria de boas praticas.",
    route: "/best-practices",
    sidebarItems: ["Boas Praticas"],
    expectedActions: CRUD,
  },
  best_practice_types: {
    menu: "Conhecimento",
    menuOrder: 50,
    title: "Tipos de Boas Praticas",
    description: "Taxonomia dos tipos usados em boas praticas.",
    route: "/best-practices",
    sidebarItems: ["Boas Praticas"],
    expectedActions: CRUD,
  },
  lessons_learned: {
    menu: "Conhecimento",
    menuOrder: 50,
    title: "Licoes Aprendidas",
    description: "Registro, analise e manutencao de licoes aprendidas.",
    route: "/lessons-learned",
    sidebarItems: ["Licoes Aprendidas"],
    expectedActions: CRUD,
  },
  cpca_cases: {
    menu: "CPCA",
    menuOrder: 60,
    title: "Casos e Operação CPCA",
    description:
      "Abertura de casos, operação da comissão CPCA e fluxo de homologações.",
    route: "/cpca-cases",
    routeAliases: ["/cpca-commission", "/cpca-president-approvals"],
    sidebarItems: ["Denúncias", "Comissão CPCA", "Homologações CPCA"],
    expectedActions: CRUD_COMMENT,
  },
  cpca_checklist: {
    menu: "CPCA",
    menuOrder: 60,
    title: "Checklist CPCA",
    description:
      "Visão nacional do checklist de ações executadas pelas comissões CPCA nas OMs.",
    route: "/cpca-checklist",
    sidebarItems: ["Checklist"],
    expectedActions: VIEW_ONLY,
  },
  cpca_dashboard: {
    menu: "CPCA",
    menuOrder: 60,
    title: "Dashboard CPCA",
    description: "Visualização do painel analítico de denúncias CPCA.",
    route: "/dashboard/cpca",
    routeAliases: ["/cpca-stats"],
    sidebarItems: ["CPCA"],
    expectedActions: VIEW_ONLY,
  },
  cpca_coverage: {
    menu: "CPCA",
    menuOrder: 60,
    title: "Cobertura CPCA",
    description:
      "Gestão nacional da cobertura CPCA por OM, com CPCA própria, cobertura delegada e exclusão restrita à TI.",
    route: "/cpca-coverage",
    routeAliases: ["/admin/oms"],
    sidebarItems: ["Cobertura"],
    expectedActions: CRUD,
  },
  smif_complaints: {
    menu: "CPCA",
    menuOrder: 60,
    title: "Denuncias SMIF",
    description: "Gestao de denuncias SMIF e seu fluxo de tratativa.",
    route: "/smif-complaints",
    sidebarItems: ["Denuncias"],
    expectedActions: CRUD_COMMENT,
  },
  elos: {
    menu: "Estrutura",
    menuOrder: 70,
    title: "Elos",
    description: "Cadastro e manutencao de elos da organizacao.",
    route: "/elos",
    sidebarItems: ["Elos"],
    expectedActions: CRUD,
  },
  org_chart: {
    menu: "Estrutura",
    menuOrder: 70,
    title: "Organograma",
    description: "Visualizacao e ajustes de membros no organograma.",
    route: "/org-chart",
    sidebarItems: ["Organograma"],
    expectedActions: CRUD,
  },
  localities: {
    menu: "Administracao",
    menuOrder: 80,
    title: "Localidades / OMs",
    description: "Cadastro das OMs e dados estruturais de localidade.",
    route: "/admin?tab=localities",
    routeAliases: [
      "/gsd-recruits",
      "/recruits-history",
      "/admin/localities",
      "/admin/localidades",
    ],
    sidebarItems: ["GSD e Recrutas", "Administracao"],
    expectedActions: CRUD,
  },
  localities_cipavd: {
    menu: "Administracao",
    menuOrder: 80,
    title: "Localidades CIPAVD",
    description:
      "Cadastro de localidades usadas pelas atividades de campo CIPAVD.",
    route: "/admin?tab=localities-cipavd",
    routeAliases: [
      "/admin/localities-cipavd",
      "/admin/localidades-cipavd",
      "/activities-cipavd",
    ],
    sidebarItems: ["Administracao", "Atividades de Campo"],
    expectedActions: CRUD,
  },
  specialties: {
    menu: "Administracao",
    menuOrder: 80,
    title: "Especialidades",
    description: "Cadastro de especialidades usadas no sistema.",
    route: "/admin",
    sidebarItems: ["Administracao"],
    expectedActions: CRUD,
  },
  postos: {
    menu: "Administracao",
    menuOrder: 80,
    title: "Postos",
    description: "Cadastro de postos para ordenacao e exibicao.",
    route: "/admin?tab=postos",
    routeAliases: ["/admin/postos"],
    sidebarItems: ["Administracao"],
    expectedActions: CRUD,
  },
  elo_roles: {
    menu: "Administracao",
    menuOrder: 80,
    title: "Papeis de Elo",
    description:
      "Cadastro de papeis de elo para atribuicao de responsabilidade.",
    route: "/admin?tab=elo-roles",
    routeAliases: ["/admin/elo-roles"],
    sidebarItems: ["Administracao"],
    expectedActions: CRUD,
  },
  users: {
    menu: "Seguranca",
    menuOrder: 90,
    title: "Usuarios",
    description: "Gestao de usuarios LDAP, papeis e dados vinculados.",
    route: "/admin/rbac",
    sidebarItems: ["Usuarios e Permissoes"],
    expectedActions: ["view", "update"],
  },
  roles: {
    menu: "Seguranca",
    menuOrder: 90,
    title: "Papeis e Permissoes",
    description: "Definicao de papeis, clonagem e atribuicao de permissoes.",
    route: "/admin/rbac",
    sidebarItems: ["Usuarios e Permissoes"],
    expectedActions: [
      "view",
      "create",
      "update",
      "delete",
      "clone",
      "permissions",
    ],
  },
  admin_rbac: {
    menu: "Seguranca",
    menuOrder: 90,
    title: "Admin RBAC",
    description: "Importacao, exportacao e simulacao de acessos RBAC.",
    route: "/admin/rbac",
    sidebarItems: ["Usuarios e Permissoes"],
    expectedActions: ["update", "export", "import"],
  },
  search: {
    menu: "Seguranca",
    menuOrder: 90,
    title: "Busca Global",
    description: "Controle de uso do mecanismo de busca unificada.",
    expectedActions: VIEW_ONLY,
  },
  audit_logs: {
    menu: "Seguranca",
    menuOrder: 90,
    title: "Logs de Auditoria",
    description: "Consulta de logs de login e trilha de auditoria do sistema.",
    route: "/audit",
    sidebarItems: ["Logs"],
    expectedActions: VIEW_ONLY,
  },
  bi: {
    menu: "Dashboards",
    menuOrder: 10,
    title: "Business Intelligence",
    description: "Hub de analise e importacao dos painéis de BI.",
    route: "/dashboard/bi",
    routeAliases: [
      "/dashboard/bi-violencia-domestica",
      "/dashboard/bi-recrutas",
      "/dashboard/bi-ciclo-boas-praticas",
      "/dashboard/bi-encontro-cpca",
      "/dashboard/bi-avaliacao-gsd",
    ],
    sidebarItems: ["Pesquisas"],
    expectedActions: ["view", "upload", "delete"],
  },
};

export const KNOWN_PERMISSION_RESOURCES = Object.keys(RESOURCE_META);

const DEFAULT_MENU_ORDER = 999;

function titleCaseToken(token: string) {
  if (!token) return "";
  const upper = token.toUpperCase();
  if (upper.length <= 4) return upper;
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

export function humanizePermissionResource(resource: string) {
  return String(resource)
    .split("_")
    .filter(Boolean)
    .map((part) => titleCaseToken(part))
    .join(" ");
}

export function getPermissionResourceMeta(
  resource: string,
): PermissionResourceMeta {
  const known = RESOURCE_META[resource];
  if (known) return known;
  const title = humanizePermissionResource(resource);
  return {
    menu: "Outros Modulos",
    menuOrder: DEFAULT_MENU_ORDER,
    title,
    description: "Permissao tecnica sem descricao funcional cadastrada.",
  };
}

export const CRUD_ACTIONS = ["view", "create", "update", "delete"] as const;
export type CrudAction = (typeof CRUD_ACTIONS)[number];

const ACTION_LABELS: Record<string, string> = {
  view: "Ver",
  create: "Criar",
  update: "Editar",
  delete: "Excluir",
  clone: "Clonar",
  assign: "Atribuir",
  export: "Exportar",
  import: "Importar",
  permissions: "Permissoes",
  pin: "Fixar",
  comment: "Comentar",
  upload: "Upload",
  download: "Download",
  approve: "Aprovar",
  generate_from_meeting: "Gerar Reuniao",
};

export function getPermissionActionLabel(action: string) {
  return ACTION_LABELS[action] ?? humanizePermissionResource(action);
}
