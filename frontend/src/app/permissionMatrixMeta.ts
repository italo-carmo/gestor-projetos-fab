export type PermissionResourceMeta = {
  menu: string;
  menuOrder: number;
  title: string;
  description: string;
  route?: string;
};

const RESOURCE_META: Record<string, PermissionResourceMeta> = {
  dashboard: {
    menu: "Dashboards",
    menuOrder: 10,
    title: "Dashboards",
    description: "Visualização e ajustes dos paineis executivos e CIPAVD.",
    route: "/dashboard/cipavd",
  },
  kpis: {
    menu: "Dashboards",
    menuOrder: 10,
    title: "KPIs",
    description: "Cadastro e manutencao de indicadores exibidos nos paineis.",
    route: "/dashboard/cipavd",
  },
  gantt: {
    menu: "Planejamento",
    menuOrder: 20,
    title: "Gantt",
    description: "Acesso ao cronograma visual de tarefas e fases.",
    route: "/gantt",
  },
  calendar: {
    menu: "Planejamento",
    menuOrder: 20,
    title: "Calendario",
    description: "Acesso ao calendario consolidado de compromissos.",
    route: "/calendar",
  },
  meetings: {
    menu: "Planejamento",
    menuOrder: 20,
    title: "Reunioes",
    description: "Gestao de reunioes, decisoes, participantes e vinculos.",
    route: "/meetings",
  },
  tasks: {
    menu: "Planejamento",
    menuOrder: 20,
    title: "Tarefas de Reuniao",
    description: "Acoes especiais de tarefas geradas a partir de reunioes.",
    route: "/meetings",
  },
  task_instances: {
    menu: "Planejamento",
    menuOrder: 20,
    title: "Tarefas",
    description: "Gestao das tarefas executadas nas OMs e na CIPAVD.",
    route: "/tasks",
  },
  task_templates: {
    menu: "Planejamento",
    menuOrder: 20,
    title: "Templates de Tarefas",
    description: "Modelos para criacao e padronizacao de tarefas.",
    route: "/templates",
  },
  task_comments: {
    menu: "Planejamento",
    menuOrder: 20,
    title: "Comentarios de Tarefa",
    description: "Registro de comentarios e historico operacional.",
    route: "/tasks",
  },
  checklists: {
    menu: "Planejamento",
    menuOrder: 20,
    title: "Checklists",
    description: "Controle de checklists por fase, OM e especialidade.",
    route: "/checklists",
  },
  phases: {
    menu: "Planejamento",
    menuOrder: 20,
    title: "Fases",
    description: "Gestao das fases usadas em tarefas e checklists.",
    route: "/admin?tab=phases",
  },
  missions: {
    menu: "Operacoes",
    menuOrder: 30,
    title: "Missoes",
    description: "Fluxos de missao, participantes, agenda e checklist.",
    route: "/missions",
  },
  activities: {
    menu: "Operacoes",
    menuOrder: 30,
    title: "Atividades de Campo",
    description: "Gestao de atividades externas, lotes e status operacionais.",
    route: "/activities-cipavd",
  },
  activity_comments: {
    menu: "Operacoes",
    menuOrder: 30,
    title: "Comentarios de Atividade",
    description: "Comentarios e colaboracao dentro de atividades de campo.",
    route: "/activities-cipavd",
  },
  reports: {
    menu: "Operacoes",
    menuOrder: 30,
    title: "Relatorios",
    description: "Upload, aprovacao e download de relatorios operacionais.",
    route: "/tasks",
  },
  notices: {
    menu: "Comunicacao",
    menuOrder: 40,
    title: "Avisos",
    description: "Publicacao e fixacao de avisos institucionais.",
    route: "/notices",
  },
  documents: {
    menu: "Comunicacao",
    menuOrder: 40,
    title: "Documentos",
    description: "Estrutura de documentos, links e subcategorias.",
    route: "/documents",
  },
  social_communication: {
    menu: "Comunicacao",
    menuOrder: 40,
    title: "Comunicacao Social",
    description: "Gestao de comunicados e cards de comunicacao social.",
    route: "/social-communication",
  },
  social_communication_highlight: {
    menu: "Comunicacao",
    menuOrder: 40,
    title: "Destaques de Comunicacao",
    description: "Painel de destaques usados na comunicacao social.",
    route: "/social-communication",
  },
  library: {
    menu: "Comunicacao",
    menuOrder: 40,
    title: "Biblioteca",
    description: "Fotos, documentos e configuracoes da biblioteca.",
    route: "/library",
  },
  best_practices: {
    menu: "Conhecimento",
    menuOrder: 50,
    title: "Boas Praticas",
    description: "Publicacoes e curadoria de boas praticas.",
    route: "/best-practices",
  },
  best_practice_types: {
    menu: "Conhecimento",
    menuOrder: 50,
    title: "Tipos de Boas Praticas",
    description: "Taxonomia dos tipos usados em boas praticas.",
    route: "/best-practices",
  },
  lessons_learned: {
    menu: "Conhecimento",
    menuOrder: 50,
    title: "Licoes Aprendidas",
    description: "Registro, analise e manutencao de licoes aprendidas.",
    route: "/lessons-learned",
  },
  cpca_cases: {
    menu: "CPCA",
    menuOrder: 60,
    title: "Casos CPCA",
    description: "Abertura, acompanhamento e comentarios em casos CPCA.",
    route: "/cpca-cases",
  },
  smif_complaints: {
    menu: "CPCA",
    menuOrder: 60,
    title: "Denuncias SMIF",
    description: "Gestao de denuncias SMIF e seu fluxo de tratativa.",
    route: "/smif-complaints",
  },
  elos: {
    menu: "Estrutura",
    menuOrder: 70,
    title: "Elos",
    description: "Cadastro e manutencao de elos da organizacao.",
    route: "/elos",
  },
  org_chart: {
    menu: "Estrutura",
    menuOrder: 70,
    title: "Organograma",
    description: "Visualizacao e ajustes de membros no organograma.",
    route: "/org-chart",
  },
  localities: {
    menu: "Administracao",
    menuOrder: 80,
    title: "Localidades / OMs",
    description: "Cadastro das OMs e dados estruturais de localidade.",
    route: "/admin?tab=localities",
  },
  specialties: {
    menu: "Administracao",
    menuOrder: 80,
    title: "Especialidades",
    description: "Cadastro de especialidades usadas no sistema.",
    route: "/admin",
  },
  postos: {
    menu: "Administracao",
    menuOrder: 80,
    title: "Postos",
    description: "Cadastro de postos para ordenacao e exibicao.",
    route: "/admin?tab=postos",
  },
  elo_roles: {
    menu: "Administracao",
    menuOrder: 80,
    title: "Papeis de Elo",
    description:
      "Cadastro de papeis de elo para atribuicao de responsabilidade.",
    route: "/admin?tab=elo-roles",
  },
  users: {
    menu: "Seguranca",
    menuOrder: 90,
    title: "Usuarios",
    description: "Gestao de usuarios LDAP, papeis e dados vinculados.",
    route: "/admin/rbac",
  },
  roles: {
    menu: "Seguranca",
    menuOrder: 90,
    title: "Papeis e Permissoes",
    description: "Definicao de papeis, clonagem e atribuicao de permissoes.",
    route: "/admin/rbac",
  },
  admin_rbac: {
    menu: "Seguranca",
    menuOrder: 90,
    title: "Admin RBAC",
    description: "Importacao, exportacao e simulacao de acessos RBAC.",
    route: "/admin/rbac",
  },
  search: {
    menu: "Seguranca",
    menuOrder: 90,
    title: "Busca Global",
    description: "Controle de uso do mecanismo de busca unificada.",
  },
  bi: {
    menu: "Dashboards",
    menuOrder: 10,
    title: "BI Pesquisas",
    description: "Importacao e consulta de dados do modulo BI.",
    route: "/dashboard/bi",
  },
};

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
  generate_from_meeting: "Gerar da Reuniao",
};

export function getPermissionActionLabel(action: string) {
  return ACTION_LABELS[action] ?? humanizePermissionResource(action);
}
