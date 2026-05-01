export type MissionScope = 'SMIF' | 'CIPAVD';

export type MissionScheduleFieldActivityDraft = {
  id: string;
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
    .map((item, index) =>
      buildMissionFieldActivityDraft(item, defaults, {
        id: `${String(item.id)}:create:${index}`,
      }),
    );
}

export function buildMissionFieldActivityDraft(
  scheduleItem: any,
  defaults?: {
    activityTypeId?: string;
    specialtyIds?: string[];
    responsibleUserId?: string;
    reportRequired?: boolean;
  },
  options?: {
    id?: string;
    action?: 'CREATE' | 'LINK';
  },
): MissionScheduleFieldActivityDraft {
  const scheduleItemId = String(scheduleItem?.id ?? '').trim();
  const action = options?.action ?? 'CREATE';
  return {
    id:
      options?.id ??
      `${scheduleItemId}:${action.toLowerCase()}:${Date.now().toString(36)}`,
    scheduleItemId,
    action,
    activityId: '',
    title: String(scheduleItem?.title ?? '').trim() || 'Atividade de campo da missão',
    eventDate: scheduleStartToDateInput(scheduleItem?.startAt),
    activityTypeId: defaults?.activityTypeId ?? '',
    specialtyIds: defaults?.specialtyIds ?? [],
    responsibleUserId: defaults?.responsibleUserId ?? '',
    reportRequired: defaults?.reportRequired ?? true,
  };
}

export function getMissionScheduleItemLinkedActivities(scheduleItem: any) {
  const map = new Map<string, any>();
  const legacyActivity = scheduleItem?.activity;
  const legacyActivityId = String(
    scheduleItem?.activityId ?? legacyActivity?.id ?? '',
  ).trim();
  if (legacyActivityId && legacyActivity) {
    map.set(legacyActivityId, legacyActivity);
  }
  const links = Array.isArray(scheduleItem?.activityLinks)
    ? scheduleItem.activityLinks
    : [];
  for (const link of links) {
    const activity = link?.activity ?? link;
    const id = String(activity?.id ?? '').trim();
    if (id) map.set(id, activity);
  }
  return Array.from(map.values());
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
