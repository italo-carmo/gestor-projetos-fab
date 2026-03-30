import type { SocialCardSetting } from './socialCardSettingsStorage';

export const DEFAULT_HIGHLIGHT_GOLD_GRADIENT =
  'linear-gradient(145deg, #b68f33 0%, #c9a44e 25%, #e2bf67 50%, #cca95a 74%, #af8d42 100%)';
export const DEFAULT_INNER_TITLE_COLOR = '#2E1E04';
export const DEFAULT_INNER_BODY_COLOR = '#3A2706';
export const PICKER_DEFAULT_INNER_BG = '#c9a44e';

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace('#', '').trim();
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (n.length !== 6) return null;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  if ([r, g, b].some((x) => Number.isNaN(x))) return null;
  return { r, g, b };
}

export function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(0,0,0,${alpha})`;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

export type InnerCardTheme = {
  cardBorder: string;
  cardBackground: string;
  titleColor: string;
  textColor: string;
  chipBg: string;
  chipBorder: string;
  chipColor: string;
  mediaBorder: string;
  mediaBg: string;
  hoverShadow: string;
  /** Botões flutuantes editar/excluir (só Comunicação Social) */
  actionButtonBg: string;
};

/** Tema visual dos cards internos de Militares Destaques (a partir das preferências salvas). */
export function buildInnerTheme(s: SocialCardSetting): InnerCardTheme {
  const title = s.highlightsInnerTitleColor?.trim() || DEFAULT_INNER_TITLE_COLOR;
  const body = s.highlightsInnerBodyColor?.trim() || DEFAULT_INNER_BODY_COLOR;
  const bg = s.highlightsInnerBackground?.trim();
  const cardBackground = bg || DEFAULT_HIGHLIGHT_GOLD_GRADIENT;
  return {
    cardBorder: hexToRgba(title, 0.42),
    cardBackground,
    titleColor: title,
    textColor: body,
    chipBg: hexToRgba(title, 0.14),
    chipBorder: hexToRgba(title, 0.38),
    chipColor: title,
    mediaBorder: hexToRgba(title, 0.48),
    mediaBg: 'rgba(255, 248, 223, 0.28)',
    hoverShadow: `0 14px 24px ${hexToRgba(title, 0.24)}`,
    actionButtonBg: 'rgba(255, 251, 236, 0.94)',
  };
}
