export type MissionScope = 'SMIF' | 'CIPAVD';

export type MissionScheduleFieldActivityDraft = {
  scheduleItemId: string;
  action: 'CREATE' | 'LINK';
  activityId: string;
  title: string;
  eventDate: string;
  activityTypeId: string;
  specialtyIds: string[];
  responsibleUserId: string;
  reportRequired: boolean;
};

export function normalizeMissionScope(raw: unknown): MissionScope {
  return String(raw ?? '')
    .trim()
    .toUpperCase() === 'CIPAVD'
    ? 'CIPAVD'
    : 'SMIF';
}

export function scheduleStartToDateInput(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildMissionFieldActivityDrafts(
  scheduleItems: any[],
  selectedIds: string[],
  defaults?: {
    activityTypeId?: string;
    specialtyIds?: string[];
    responsibleUserId?: string;
    reportRequired?: boolean;
  },
): MissionScheduleFieldActivityDraft[] {
  const selected = new Set(
    (selectedIds ?? []).map((id) => String(id ?? '').trim()).filter(Boolean),
  );
  return (scheduleItems ?? [])
    .filter((item) => selected.has(String(item?.id ?? '')))
    .map((item) => ({
      scheduleItemId: String(item.id),
      action: 'CREATE' as const,
      activityId: '',
      title: String(item?.title ?? '').trim() || 'Atividade de campo da missão',
      eventDate: scheduleStartToDateInput(item?.startAt),
      activityTypeId: defaults?.activityTypeId ?? '',
      specialtyIds: defaults?.specialtyIds ?? [],
      responsibleUserId: defaults?.responsibleUserId ?? '',
      reportRequired: defaults?.reportRequired ?? true,
    }));
}

export function getMissionFieldActivityValidationMessage(
  draft: MissionScheduleFieldActivityDraft,
) {
  if (draft.action === 'LINK') {
    return draft.activityId ? '' : 'Selecione a atividade existente.';
  }
  if (!draft.title.trim()) return 'Informe o título.';
  if (!draft.eventDate) return 'Informe a data.';
  return '';
}

export function buildMissionFieldActivityRequestItems(
  drafts: MissionScheduleFieldActivityDraft[],
) {
  return drafts.map((draft) => ({
    scheduleItemId: draft.scheduleItemId,
    action: draft.action,
    activityId: draft.action === 'LINK' ? draft.activityId || null : null,
    title: draft.action === 'CREATE' ? draft.title : undefined,
    activityTypeId:
      draft.action === 'CREATE' ? draft.activityTypeId || null : undefined,
    specialtyIds: draft.action === 'CREATE' ? draft.specialtyIds : undefined,
    responsibleUserIds:
      draft.action === 'CREATE' && draft.responsibleUserId
        ? [draft.responsibleUserId]
        : [],
    eventDate: draft.action === 'CREATE' ? draft.eventDate || null : undefined,
    reportRequired:
      draft.action === 'CREATE' ? draft.reportRequired : undefined,
  }));
}
