export const SOCIAL_CARD_SETTINGS_STORAGE_KEY =
  'social-communication-card-settings-v1';

export type SocialCardId =
  | 'social-public-internal'
  | 'social-public-external'
  | 'social-highlights';

export type SocialCardSetting = {
  title: string;
  customBackgroundColor?: string;
  impactMultiplicadorTitle: string;
  impactSimbolicoTitle: string;
};

export const SOCIAL_CARD_DEFAULT_SETTINGS: Record<
  SocialCardId,
  SocialCardSetting
> = {
  'social-public-internal': {
    title: 'Público Interno',
    customBackgroundColor: undefined,
    impactMultiplicadorTitle: 'Impacto Multiplicador',
    impactSimbolicoTitle: 'Impacto Simbólico',
  },
  'social-public-external': {
    title: 'Público Externo',
    customBackgroundColor: undefined,
    impactMultiplicadorTitle: 'Impacto Multiplicador',
    impactSimbolicoTitle: 'Impacto Simbólico',
  },
  'social-highlights': {
    title: 'Militares Destaques',
    customBackgroundColor: undefined,
    impactMultiplicadorTitle: 'Impacto Multiplicador',
    impactSimbolicoTitle: 'Impacto Simbólico',
  },
};

export const SOCIAL_CARD_EDITOR_DEFAULT_COLORS: Record<SocialCardId, string> = {
  'social-public-internal': '#6793AD',
  'social-public-external': '#A2C4D6',
  'social-highlights': '#FFFFFF',
};

function isSocialCardId(value: string): value is SocialCardId {
  return (
    value === 'social-public-internal' ||
    value === 'social-public-external' ||
    value === 'social-highlights'
  );
}

export function loadSocialCardSettings(): Record<SocialCardId, SocialCardSetting> {
  const merged = { ...SOCIAL_CARD_DEFAULT_SETTINGS };
  if (typeof window === 'undefined') return merged;
  try {
    const raw = window.localStorage.getItem(SOCIAL_CARD_SETTINGS_STORAGE_KEY);
    if (!raw) return merged;
    const parsed = JSON.parse(raw) as Record<
      string,
      Partial<SocialCardSetting> | undefined
    >;
    if (!parsed || typeof parsed !== 'object') return merged;
    for (const [key, value] of Object.entries(parsed)) {
      if (!isSocialCardId(key) || !value) continue;
      const defaults = SOCIAL_CARD_DEFAULT_SETTINGS[key];
      merged[key] = {
        title:
          typeof value.title === 'string' && value.title.trim()
            ? value.title
            : defaults.title,
        customBackgroundColor:
          typeof value.customBackgroundColor === 'string' &&
          value.customBackgroundColor.trim()
            ? value.customBackgroundColor
            : undefined,
        impactMultiplicadorTitle:
          typeof value.impactMultiplicadorTitle === 'string' &&
          value.impactMultiplicadorTitle.trim()
            ? value.impactMultiplicadorTitle
            : defaults.impactMultiplicadorTitle,
        impactSimbolicoTitle:
          typeof value.impactSimbolicoTitle === 'string' &&
          value.impactSimbolicoTitle.trim()
            ? value.impactSimbolicoTitle
            : defaults.impactSimbolicoTitle,
      };
    }
    return merged;
  } catch {
    return merged;
  }
}

/** Persista e notifique outras instâncias na mesma aba (ex.: painel GSD). */
export function persistSocialCardSettings(
  next: Record<SocialCardId, SocialCardSetting>,
) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    SOCIAL_CARD_SETTINGS_STORAGE_KEY,
    JSON.stringify(next),
  );
  window.dispatchEvent(new CustomEvent('social-card-settings-changed'));
}
