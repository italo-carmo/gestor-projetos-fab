export const TaskStatus = [
  'NOT_STARTED',
  'STARTED',
  'IN_PROGRESS',
  'DONE',
  'BLOCKED',
] as const;

/** Rótulos em português para exibição nos selects de status */
export const TASK_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Não iniciada',
  STARTED: 'Iniciada',
  IN_PROGRESS: 'Em andamento',
  BLOCKED: 'Bloqueada',
  DONE: 'Concluída',
};

export const TaskPriority = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export const TASK_PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: 'Crítica',
  HIGH: 'Alta',
  MEDIUM: 'Média',
  LOW: 'Baixa',
};

export const ActivityStatus = ['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const;

export const ACTIVITY_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Não iniciada',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluída',
  CANCELLED: 'Cancelada',
};

export const PhaseName = ['PREPARACAO', 'EXECUCAO', 'ACOMPANHAMENTO'] as const;

export const NoticePriority = ['LOW', 'MEDIUM', 'HIGH'] as const;

/** Rótulos em português para prioridade de avisos */
export const NOTICE_PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
};

export const ChecklistItemStatus = ['NOT_STARTED', 'IN_PROGRESS', 'DONE'] as const;

export const CHECKLIST_ITEM_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Não iniciado',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluído',
};

export const MeetingStatus = ['PLANNED', 'HELD', 'CANCELLED'] as const;

export const MEETING_STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Planejada',
  HELD: 'Realizada',
  CANCELLED: 'Cancelada',
};

export const MeetingType = ['ONLINE', 'PRESENCIAL'] as const;

export const MEETING_TYPE_LABELS: Record<string, string> = {
  ONLINE: 'Online',
  PRESENCIAL: 'Presencial',
};

export const EloRoleType = ['PSICOLOGIA', 'SSO', 'JURIDICO', 'CPCA', 'GRAD_MASTER'] as const;

export const KpiVisibility = ['DEFAULT', 'EXECUTIVE'] as const;

export const PermissionScope = [
  'NATIONAL',
  'LOCALITY',
  'SPECIALTY',
  'LOCALITY_SPECIALTY',
  'OWN',
] as const;
