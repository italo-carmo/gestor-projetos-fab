export const MISSIONS_PAGE_UI_SETTINGS_KEY = 'missions-page-ui-settings-v1';

export type MissionsStatsSectionUi = {
  title: string;
  description: string;
};

export const MISSIONS_STATS_SECTION_DEFAULTS: MissionsStatsSectionUi = {
  title: 'Estatísticas de Missões',
  description: '',
};

export type MissionsPageUiSettings = {
  statsSection: MissionsStatsSectionUi;
};

export function loadMissionsPageUiSettings(): MissionsPageUiSettings {
  const merged: MissionsPageUiSettings = {
    statsSection: { ...MISSIONS_STATS_SECTION_DEFAULTS },
  };
  if (typeof window === 'undefined') return merged;
  try {
    const raw = window.localStorage.getItem(MISSIONS_PAGE_UI_SETTINGS_KEY);
    if (!raw) return merged;
    const parsed = JSON.parse(raw) as Partial<{
      statsSection?: Partial<MissionsStatsSectionUi>;
    }>;
    if (!parsed || typeof parsed !== 'object') return merged;
    const s = parsed.statsSection;
    if (s && typeof s === 'object') {
      merged.statsSection = {
        title:
          typeof s.title === 'string' ? s.title : MISSIONS_STATS_SECTION_DEFAULTS.title,
        description:
          typeof s.description === 'string'
            ? s.description
            : MISSIONS_STATS_SECTION_DEFAULTS.description,
      };
    }
    return merged;
  } catch {
    return merged;
  }
}

export function persistMissionsPageUiSettings(next: MissionsPageUiSettings) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(MISSIONS_PAGE_UI_SETTINGS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('missions-page-ui-settings-changed'));
}
