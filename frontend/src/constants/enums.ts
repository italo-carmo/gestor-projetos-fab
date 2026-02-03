export const TaskStatus = [
  'NOT_STARTED',
  'STARTED',
  'IN_PROGRESS',
  'DONE',
  'BLOCKED',
] as const;

export const TaskPriority = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;

export const PhaseName = ['PREPARACAO', 'EXECUCAO', 'ACOMPANHAMENTO'] as const;

export const NoticePriority = ['LOW', 'MEDIUM', 'HIGH'] as const;

export const ChecklistItemStatus = ['NOT_STARTED', 'IN_PROGRESS', 'DONE'] as const;

export const MeetingStatus = ['PLANNED', 'HELD', 'CANCELLED'] as const;

export const MeetingScope = ['NATIONAL', 'LOCALITY'] as const;

export const EloRoleType = ['PSICOLOGIA', 'SSO', 'JURIDICO', 'CPCA', 'GRAD_MASTER'] as const;

export const PermissionScope = [
  'NATIONAL',
  'LOCALITY',
  'SPECIALTY',
  'LOCALITY_SPECIALTY',
  'OWN',
] as const;
