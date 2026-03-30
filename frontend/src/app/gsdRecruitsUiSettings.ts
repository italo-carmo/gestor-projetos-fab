export const GSD_RECRUITS_UI_SETTINGS_KEY = 'gsd-recruits-ui-settings-v1';

export type GsdRecruitsUiSectionId = 'smifLocalities' | 'managementTable';

export type GsdRecruitsUiSection = {
  title: string;
  description: string;
};

export const GSD_RECRUITS_UI_DEFAULTS: Record<
  GsdRecruitsUiSectionId,
  GsdRecruitsUiSection
> = {
  smifLocalities: {
    title: 'Localidades SMIF',
    description: '',
  },
  managementTable: {
    title: '',
    description: '',
  },
};

function isSectionId(value: string): value is GsdRecruitsUiSectionId {
  return value === 'smifLocalities' || value === 'managementTable';
}

export function loadGsdRecruitsUiSettings(): Record<
  GsdRecruitsUiSectionId,
  GsdRecruitsUiSection
> {
  const merged = {
    smifLocalities: { ...GSD_RECRUITS_UI_DEFAULTS.smifLocalities },
    managementTable: { ...GSD_RECRUITS_UI_DEFAULTS.managementTable },
  };
  if (typeof window === 'undefined') return merged;
  try {
    const raw = window.localStorage.getItem(GSD_RECRUITS_UI_SETTINGS_KEY);
    if (!raw) return merged;
    const parsed = JSON.parse(raw) as Record<string, Partial<GsdRecruitsUiSection> | undefined>;
    if (!parsed || typeof parsed !== 'object') return merged;
    for (const [key, value] of Object.entries(parsed)) {
      if (!isSectionId(key) || !value) continue;
      const d = GSD_RECRUITS_UI_DEFAULTS[key];
      merged[key] = {
        title:
          typeof value.title === 'string' ? value.title : d.title,
        description:
          typeof value.description === 'string' ? value.description : d.description,
      };
    }
    return merged;
  } catch {
    return merged;
  }
}

export function persistGsdRecruitsUiSettings(
  next: Record<GsdRecruitsUiSectionId, GsdRecruitsUiSection>,
) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(GSD_RECRUITS_UI_SETTINGS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('gsd-recruits-ui-settings-changed'));
}
