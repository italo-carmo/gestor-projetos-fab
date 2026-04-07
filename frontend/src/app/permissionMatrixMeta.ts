export type PermissionResourceMeta = {
  menu: string;
  menuOrder: number;
  title: string;
  description: string;
  route?: string;
  routeAliases?: string[];
  sidebarItems?: string[];
};

const RESOURCE_META: Record<string, PermissionResourceMeta> = {
  dashboard: {
    menu: "Dashboards",
    menuOrder: 10,
    title: "Dashboards",
    description: "Visualização e ajustes dos paineis executivos e CIPAVD.",
    route: "/dashboard/smif",
    routeAliases: ["/dashboard/cipavd"],
    sidebarItems: ["SMIF", "CIPAVD", "BI Pesquisas"],
  },
  kpis: {
    menu: "Dashboards",
    menuOrder: 10,
    title: "KPIs",
    description: "Cadastro e manutencao de indicadores exibidos nos paineis.",
    route: "/dashboard/cipavd",
    sidebarItems: ["CIPAVD"],
  },
  gantt: {
    menu: "Planejamento",
    menuOrder: 20,
    title: "Gantt",
    description: "Acesso ao cronograma visual de tarefas e fases.",
    route: "/gantt",
    sidebarItems: ["Cronograma"],
  },
  calendar: {
    menu: "Planejamento",
    menuOrder: 20,
    title: "Calendario",
    description: "Acesso ao calendario consolidado de compromissos.",
    route: "/calendar",
    sidebarItems: ["Calendario"],
  },
  meetings: {
    menu: "Planejamento",
    menuOrder: 20,
    title: "Reunioes",
    description: "Gestao de reunioes, decisoes, participantes e vinculos.",
    route: "/meetings",
    sidebarItems: ["Reunioes"],
  },
  tasks: {
    menu: "Planejamento",
    menuOrder: 20,
    title: "Tarefas de Reuniao",
    description: "Acoes especiais de tarefas geradas a partir de reunioes.",
    route: "/meetings",
    sidebarItems: ["Reunioes"],
  },
  task_instances: {
    menu: "Planejamento",
    menuOrder: 20,
    title: "Tarefas",
    description: "Gestao das tarefas executadas nas OMs e na CIPAVD.",
    route: "/tasks",
    sidebarItems: ["Tarefas", "Atividades de Campo"],
  },
  task_templates: {
    menu: "Planejamento",
    menuOrder: 20,
    title: "Templates de Tarefas",
    description: "Modelos para criacao e padronizacao de tarefas.",
    route: "/templates",
    sidebarItems: ["Administração"],
  },
  task_comments: {
    menu: "Planejamento",
    menuOrder: 20,
    title: "Comentarios de Tarefa",
    description: "Registro de comentarios e historico operacional.",
    route: "/tasks",
    sidebarItems: ["Tarefas"],
  },
  checklists: {
    menu: "Planejamento",
    menuOrder: 20,
    title: "Checklists",
    description: "Controle de checklists por fase, OM e especialidade.",
    route: "/checklists",
    sidebarItems: ["Checklists"],
  },
  phases: {
    menu: "Planejamento",
    menuOrder: 20,
    title: "Fases",
    description: "Gestao das fases usadas em tarefas e checklists.",
    route: "/admin?tab=phases",
    sidebarItems: ["Administracao"],
  },
  missions: {
    menu: "Operacoes",
    menuOrder: 30,
    title: "Missoes",
    description: "Fluxos de missao, participantes, agenda e checklist.",
    route: "/missions",
    sidebarItems: ["Missoes"],
  },
  activities: {
    menu: "Operacoes",
    menuOrder: 30,
    title: "Atividades de Campo",
    description: "Gestao de atividades externas, lotes e status operacionais.",
    route: "/activities",
    routeAliases: ["/activities-cipavd"],
    sidebarItems: ["Atividades de Campo"],
  },
  activity_comments: {
    menu: "Operacoes",
    menuOrder: 30,
    title: "Comentarios de Atividade",
    description: "Comentarios e colaboracao dentro de atividades de campo.",
    route: "/activities-cipavd",
    sidebarItems: ["Atividades de Campo"],
  },
  reports: {
    menu: "Operacoes",
    menuOrder: 30,
    title: "Relatorios",
    description: "Upload, aprovacao e download de relatorios operacionais.",
    route: "/tasks",
    sidebarItems: ["Atividades de Campo", "Tarefas"],
  },
  notices: {
    menu: "Comunicacao",
    menuOrder: 40,
    title: "Avisos",
    description: "Publicacao e fixacao de avisos institucionais.",
    route: "/notices",
    sidebarItems: ["Avisos"],
  },
  documents: {
    menu: "Comunicacao",
    menuOrder: 40,
    title: "Documentos",
    description: "Estrutura de documentos, links e subcategorias.",
    route: "/documents",
    sidebarItems: ["Documentos"],
  },
  social_communication: {
    menu: "Comunicacao",
    menuOrder: 40,
    title: "Comunicacao Social",
    description: "Gestao de comunicados e cards de comunicacao social.",
    route: "/social-communication",
    sidebarItems: ["Impacto Positivo"],
  },
  social_communication_highlight: {
    menu: "Comunicacao",
    menuOrder: 40,
    title: "Destaques de Comunicacao",
    description: "Painel de destaques usados na comunicacao social.",
    route: "/social-communication",
    sidebarItems: ["Impacto Positivo"],
  },
  library: {
    menu: "Comunicacao",
    menuOrder: 40,
    title: "Biblioteca",
    description: "Fotos, documentos e configuracoes da biblioteca.",
    route: "/library",
    sidebarItems: ["Biblioteca"],
  },
  best_practices: {
    menu: "Conhecimento",
    menuOrder: 50,
    title: "Boas Praticas",
    description: "Publicacoes e curadoria de boas praticas.",
    route: "/best-practices",
    sidebarItems: ["Boas Praticas"],
  },
  best_practice_types: {
    menu: "Conhecimento",
    menuOrder: 50,
    title: "Tipos de Boas Praticas",
    description: "Taxonomia dos tipos usados em boas praticas.",
    route: "/best-practices",
    sidebarItems: ["Boas Praticas"],
  },
  lessons_learned: {
    menu: "Conhecimento",
    menuOrder: 50,
    title: "Licoes Aprendidas",
    description: "Registro, analise e manutencao de licoes aprendidas.",
    route: "/lessons-learned",
    sidebarItems: ["Licoes Aprendidas"],
  },
  cpca_cases: {
    menu: "CPCA",
    menuOrder: 60,
    title: "Casos CPCA",
    description: "Abertura, acompanhamento e comentarios em casos CPCA.",
    route: "/cpca-cases",
    routeAliases: ["/dashboard/cpca"],
    sidebarItems: ["CPCA", "Denuncias"],
  },
  smif_complaints: {
    menu: "CPCA",
    menuOrder: 60,
    title: "Denuncias SMIF",
    description: "Gestao de denuncias SMIF e seu fluxo de tratativa.",
    route: "/smif-complaints",
    sidebarItems: ["Denuncias"],
  },
  elos: {
    menu: "Estrutura",
    menuOrder: 70,
    title: "Elos",
    description: "Cadastro e manutencao de elos da organizacao.",
    route: "/elos",
    sidebarItems: ["Elos"],
  },
  org_chart: {
    menu: "Estrutura",
    menuOrder: 70,
    title: "Organograma",
    description: "Visualizacao e ajustes de membros no organograma.",
    route: "/org-chart",
    sidebarItems: ["Organograma"],
  },
  localities: {
    menu: "Administracao",
    menuOrder: 80,
    title: "Localidades / OMs",
    description: "Cadastro das OMs e dados estruturais de localidade.",
    route: "/gsd-recruits",
    routeAliases: ["/admin/oms"],
    sidebarItems: ["GSD e Recrutas", "Administracao", "OMs"],
  },
  specialties: {
    menu: "Administracao",
    menuOrder: 80,
    title: "Especialidades",
    description: "Cadastro de especialidades usadas no sistema.",
    route: "/admin",
    sidebarItems: ["Administracao"],
  },
  postos: {
    menu: "Administracao",
    menuOrder: 80,
    title: "Postos",
    description: "Cadastro de postos para ordenacao e exibicao.",
    route: "/admin?tab=postos",
    sidebarItems: ["Administracao"],
  },
  elo_roles: {
    menu: "Administracao",
    menuOrder: 80,
    title: "Papeis de Elo",
    description:
      "Cadastro de papeis de elo para atribuicao de responsabilidade.",
    route: "/admin?tab=elo-roles",
    sidebarItems: ["Administracao"],
  },
  users: {
    menu: "Seguranca",
    menuOrder: 90,
    title: "Usuarios",
    description: "Gestao de usuarios LDAP, papeis e dados vinculados.",
    route: "/admin/rbac",
    sidebarItems: ["Usuarios e Permissoes"],
  },
  roles: {
    menu: "Seguranca",
    menuOrder: 90,
    title: "Papeis e Permissoes",
    description: "Definicao de papeis, clonagem e atribuicao de permissoes.",
    route: "/admin/rbac",
    sidebarItems: ["Usuarios e Permissoes"],
  },
  admin_rbac: {
    menu: "Seguranca",
    menuOrder: 90,
    title: "Admin RBAC",
    description: "Importacao, exportacao e simulacao de acessos RBAC.",
    route: "/admin/rbac",
    sidebarItems: ["Usuarios e Permissoes"],
  },
  search: {
    menu: "Seguranca",
    menuOrder: 90,
    title: "Busca Global",
    description: "Controle de uso do mecanismo de busca unificada.",
  },
  audit_logs: {
    menu: "Seguranca",
    menuOrder: 90,
    title: "Logs de Auditoria",
    description: "Consulta de logs de login e trilha de auditoria do sistema.",
    route: "/audit",
    sidebarItems: ["Logs"],
  },
  bi: {
    menu: "Dashboards",
    menuOrder: 10,
    title: "BI Pesquisas",
    description: "Importacao e consulta de dados do modulo BI.",
    route: "/dashboard/bi",
    sidebarItems: ["BI Pesquisas"],
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
