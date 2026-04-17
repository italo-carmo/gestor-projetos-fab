import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import FormatPaintOutlinedIcon from '@mui/icons-material/FormatPaintOutlined';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import bannerTemplateImage from '../../assets/cipavd-banner-template.jpg';

const TEMPLATE_WIDTH = 904;
const TEMPLATE_HEIGHT = 1280;
const COLOR_PINK = '#F6C3CF';
const COLOR_WHITE = '#FFFFFF';
const BANNER_FONT_FAMILY = 'Arial, Helvetica, sans-serif';

export const missionBannerLayoutKeys = [
  'day',
  'month',
  'time',
  'weekday',
  'locationPrimary',
  'locationSecondary',
] as const;

export type MissionBannerLayoutBlockKey =
  (typeof missionBannerLayoutKeys)[number];

export type MissionBannerLayoutBlockOverride = {
  xPct?: number;
  yPct?: number;
  fontSizePx?: number;
  fontScale?: number;
  colorHex?: string;
  textOverride?: string;
};

export type MissionBannerLayoutOverrides = Partial<
  Record<MissionBannerLayoutBlockKey, MissionBannerLayoutBlockOverride>
>;

type MissionBannerLayoutEditorProps = {
  eventDate: string;
  eventTime: string;
  locationPrimary: string;
  locationSecondary: string;
  layoutOverrides: MissionBannerLayoutOverrides;
  onChange: (next: MissionBannerLayoutOverrides) => void;
};

type TextBlockDefinition = {
  key: MissionBannerLayoutBlockKey;
  label: string;
  text: string;
  defaultColor: string;
  fontWeight: number;
  xPct: number;
  yPct: number;
  fontSizeBase: number;
  minFontSize: number;
  maxWidth: number;
};

const bannerColorPalette = [
  COLOR_PINK,
  COLOR_WHITE,
  '#0F2D7A',
  '#79C4FF',
  '#111827',
  '#D7263D',
] as const;

function parseBannerDate(value: string) {
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value);
  if (!match) {
    return { year: 2026, month: 1, day: 1 };
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function formatMonthLabel(month: number) {
  const months = [
    'JANEIRO',
    'FEVEREIRO',
    'MARÇO',
    'ABRIL',
    'MAIO',
    'JUNHO',
    'JULHO',
    'AGOSTO',
    'SETEMBRO',
    'OUTUBRO',
    'NOVEMBRO',
    'DEZEMBRO',
  ];
  return months[Math.max(0, Math.min(month - 1, 11))] ?? '';
}

function formatWeekdayLabel(date: { year: number; month: number; day: number }) {
  const normalizedDate = new Date(
    Date.UTC(date.year, date.month - 1, date.day, 12, 0, 0),
  );
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    timeZone: 'UTC',
  })
    .format(normalizedDate)
    .replace(/-feira$/i, '')
    .toUpperCase();
}

function sanitizeLine(value: string) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 120);
}

function splitLocationTextIntoTwoLines(text: string) {
  const normalized = sanitizeLine(text);
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length < 2) return { line1: normalized, line2: '' };

  let bestIndex = 1;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let index = 1; index < words.length; index += 1) {
    const left = words.slice(0, index).join(' ');
    const right = words.slice(index).join(' ');
    const leftUnits = estimateTextUnits(left);
    const rightUnits = estimateTextUnits(right);
    const score = Math.max(leftUnits, rightUnits) + Math.abs(leftUnits - rightUnits) * 0.18;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return {
    line1: words.slice(0, bestIndex).join(' '),
    line2: words.slice(bestIndex).join(' '),
  };
}

function resolveLocationLines(
  primaryRaw: string,
  secondaryRaw: string | null | undefined,
  maxWidth: number,
) {
  const line1 = sanitizeLine(primaryRaw);
  const explicitLine2 = sanitizeLine(secondaryRaw ?? '');
  if (!line1 && !explicitLine2) return { line1: '', line2: '' };

  if (explicitLine2) {
    if (
      textFitsWithinWidth(line1, maxWidth, 18) &&
      textFitsWithinWidth(explicitLine2, maxWidth, 16)
    ) {
      return { line1, line2: explicitLine2 };
    }
    return splitLocationTextIntoTwoLines(`${line1} ${explicitLine2}`.trim());
  }

  if (
    textFitsWithinWidth(line1, maxWidth, 18) ||
    line1.length <= 16 ||
    !line1.includes(' ')
  ) {
    return { line1, line2: '' };
  }

  return splitLocationTextIntoTwoLines(line1);
}

function fitTextToWidth(
  text: string,
  maxWidth: number,
  minSize: number,
  maxSize: number,
  safetyFactor = 1.16,
) {
  if (!text) return maxSize;
  const units = getLongestLineUnits(text);
  if (units <= 0) return maxSize;
  const idealFont = maxWidth / (units * safetyFactor);
  return Math.max(minSize, Math.min(maxSize, idealFont));
}

function textFitsWithinWidth(text: string, maxWidth: number, minSize: number) {
  return getLongestLineUnits(text) * minSize * 1.16 <= maxWidth;
}

function estimateTextUnits(text: string) {
  const normalized = String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  let units = 0;
  for (const char of normalized) {
    if (char === ' ') {
      units += 0.34;
      continue;
    }
    if (/[.,:;'`"]/u.test(char)) {
      units += 0.22;
      continue;
    }
    if (/[!|(){}\[\]\\/]/u.test(char)) {
      units += 0.30;
      continue;
    }
    if (/[ilIjtfr1]/u.test(char)) {
      units += 0.4;
      continue;
    }
    if (/[mwMWQO0@#%&]/u.test(char)) {
      units += 0.92;
      continue;
    }
    if (/[A-Z]/u.test(char)) {
      units += 0.74;
      continue;
    }
    if (/[0-9]/u.test(char)) {
      units += 0.62;
      continue;
    }
    units += 0.58;
  }
  return units;
}

function getLongestLineUnits(text: string) {
  return Math.max(
    ...String(text ?? '')
      .split('\n')
      .map((line) => estimateTextUnits(line)),
    0,
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeLayoutOverrides(
  value: MissionBannerLayoutOverrides | null | undefined,
): MissionBannerLayoutOverrides {
  if (!value) return {};
  const normalized: MissionBannerLayoutOverrides = {};
  for (const key of missionBannerLayoutKeys) {
    const block = value[key];
    if (!block) continue;
    const next: MissionBannerLayoutBlockOverride = {};
    if (typeof block.xPct === 'number' && Number.isFinite(block.xPct)) {
      next.xPct = clamp(block.xPct, 0.05, 0.92);
    }
    if (typeof block.yPct === 'number' && Number.isFinite(block.yPct)) {
      next.yPct = clamp(block.yPct, 0.05, 0.95);
    }
    if (typeof block.fontSizePx === 'number' && Number.isFinite(block.fontSizePx)) {
      next.fontSizePx = clamp(block.fontSizePx, 8, 180);
    }
    if (
      typeof block.colorHex === 'string' &&
      /^#([0-9a-f]{6})$/i.test(block.colorHex.trim())
    ) {
      next.colorHex = block.colorHex.trim().toUpperCase();
    }
    if (typeof block.textOverride === 'string') {
      const normalizedText = block.textOverride
        .split('\n')
        .map((line) => sanitizeLine(line))
        .join('\n')
        .trim();
      if (normalizedText) {
        next.textOverride = normalizedText;
      }
    }
    if (typeof block.fontScale === 'number' && Number.isFinite(block.fontScale)) {
      next.fontScale = clamp(block.fontScale, 0.45, 1.8);
    }
    if (Object.keys(next).length > 0) {
      normalized[key] = next;
    }
  }
  return normalized;
}

function normalizeHexColorInput(value: string) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  const prefixed = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(prefixed);
  if (!match) return null;
  const hex = match[1];
  if (hex.length === 3) {
    return `#${hex
      .split('')
      .map((char) => `${char}${char}`)
      .join('')
      .toUpperCase()}`;
  }
  return prefixed.toUpperCase();
}

export function MissionBannerLayoutEditor({
  eventDate,
  eventTime,
  locationPrimary,
  locationSecondary,
  layoutOverrides,
  onChange,
}: MissionBannerLayoutEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectedBlock, setSelectedBlock] =
    useState<MissionBannerLayoutBlockKey>('locationPrimary');
  const [selectedBlockKeys, setSelectedBlockKeys] = useState<
    MissionBannerLayoutBlockKey[]
  >(['locationPrimary']);
  const [inlineEditorValue, setInlineEditorValue] = useState('');
  const [colorInputValue, setColorInputValue] = useState(COLOR_PINK);
  const [editingTextBlockKey, setEditingTextBlockKey] =
    useState<MissionBannerLayoutBlockKey | null>(null);
  const [fontSizeInputValue, setFontSizeInputValue] = useState('');
  const [styleClipboard, setStyleClipboard] = useState<{
    fontSizePx: number;
    colorHex: string;
  } | null>(null);
  const [formatPainterArmed, setFormatPainterArmed] = useState(false);

  const normalizedOverrides = useMemo(
    () => normalizeLayoutOverrides(layoutOverrides),
    [layoutOverrides],
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () => {
      const nextWidth = element.clientWidth;
      setDimensions({
        width: nextWidth,
        height: nextWidth * (TEMPLATE_HEIGHT / TEMPLATE_WIDTH),
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const blocks = useMemo(() => {
    const dateParts = parseBannerDate(eventDate || '2026-01-01');
    const weekdayLabel = formatWeekdayLabel(dateParts);
    const monthLabel = formatMonthLabel(dateParts.month);
    const dayLabel = String(dateParts.day);
    const timeLabel = String(eventTime || '08:30').replace(':', 'h');
    const location = resolveLocationLines(
      locationPrimary,
      locationSecondary,
      TEMPLATE_WIDTH * 0.245,
    );

    const dayFont = fitTextToWidth(dayLabel, TEMPLATE_WIDTH * 0.22, TEMPLATE_WIDTH * 0.074, TEMPLATE_WIDTH * 0.10);
    const monthFont = fitTextToWidth(monthLabel, TEMPLATE_WIDTH * 0.22, TEMPLATE_WIDTH * 0.038, TEMPLATE_WIDTH * 0.075);
    const timeFont = fitTextToWidth(timeLabel, TEMPLATE_WIDTH * 0.24, TEMPLATE_WIDTH * 0.060, TEMPLATE_WIDTH * 0.10);
    const weekdayFont = fitTextToWidth(weekdayLabel, TEMPLATE_WIDTH * 0.24, TEMPLATE_WIDTH * 0.040, TEMPLATE_WIDTH * 0.075);
    const locationPrimaryFont = fitTextToWidth(location.line1, TEMPLATE_WIDTH * 0.245, TEMPLATE_WIDTH * 0.028, TEMPLATE_WIDTH * 0.086, 1.42);
    const locationSecondaryFont = fitTextToWidth(location.line2, TEMPLATE_WIDTH * 0.245, TEMPLATE_WIDTH * 0.024, TEMPLATE_WIDTH * 0.072, 1.34);

    return [
      {
        key: 'day',
        label: 'Dia',
        text: dayLabel,
        defaultColor: COLOR_PINK,
        fontWeight: 700,
        xPct: 0.632,
        yPct: 0.493,
        fontSizeBase: dayFont,
        minFontSize: 18,
        maxWidth: TEMPLATE_WIDTH * 0.22,
      },
      {
        key: 'month',
        label: 'Mês',
        text: monthLabel,
        defaultColor: COLOR_WHITE,
        fontWeight: 400,
        xPct: 0.632,
        yPct: 0.553,
        fontSizeBase: monthFont,
        minFontSize: 14,
        maxWidth: TEMPLATE_WIDTH * 0.22,
      },
      {
        key: 'time',
        label: 'Hora',
        text: timeLabel,
        defaultColor: COLOR_PINK,
        fontWeight: 700,
        xPct: 0.632,
        yPct: 0.632,
        fontSizeBase: timeFont,
        minFontSize: 16,
        maxWidth: TEMPLATE_WIDTH * 0.24,
      },
      {
        key: 'weekday',
        label: 'Dia da semana',
        text: weekdayLabel,
        defaultColor: COLOR_WHITE,
        fontWeight: 400,
        xPct: 0.632,
        yPct: 0.694,
        fontSizeBase: weekdayFont,
        minFontSize: 14,
        maxWidth: TEMPLATE_WIDTH * 0.24,
      },
      {
        key: 'locationPrimary',
        label: 'Local linha 1',
        text: location.line1 || 'Local principal',
        defaultColor: COLOR_PINK,
        fontWeight: 700,
        xPct: 0.632,
        yPct: 0.818,
        fontSizeBase: locationPrimaryFont,
        minFontSize: 12,
        maxWidth: TEMPLATE_WIDTH * 0.245,
      },
      {
        key: 'locationSecondary',
        label: 'Local linha 2',
        text: location.line2,
        defaultColor: COLOR_WHITE,
        fontWeight: 400,
        xPct: 0.632,
        yPct: 0.878,
        fontSizeBase: locationSecondaryFont,
        minFontSize: 11,
        maxWidth: TEMPLATE_WIDTH * 0.245,
      },
    ] satisfies TextBlockDefinition[];
  }, [eventDate, eventTime, locationPrimary, locationSecondary]);

  const visibleBlocks = useMemo(
    () => blocks.filter((block) => block.text.trim().length > 0),
    [blocks],
  );

  useEffect(() => {
    const visibleKeys = new Set(visibleBlocks.map((block) => block.key));
    const nextSelected = selectedBlockKeys.filter((key) => visibleKeys.has(key));
    if (!nextSelected.length) {
      const fallback = visibleBlocks[0]?.key ?? 'locationPrimary';
      setSelectedBlock(fallback);
      setSelectedBlockKeys([fallback]);
      return;
    }
    if (
      nextSelected.length !== selectedBlockKeys.length ||
      nextSelected.some((key, index) => key !== selectedBlockKeys[index])
    ) {
      setSelectedBlockKeys(nextSelected);
    }
    if (!nextSelected.includes(selectedBlock)) {
      setSelectedBlock(nextSelected[0]);
    }
  }, [selectedBlock, selectedBlockKeys, visibleBlocks]);

  const activeBlock = visibleBlocks.find((block) => block.key === selectedBlock) ?? null;
  const selectedBlocks = visibleBlocks.filter((block) =>
    selectedBlockKeys.includes(block.key),
  );
  const hasMultipleSelection = selectedBlocks.length > 1;
  const activeGuidePosition = activeBlock
    ? {
        currentXPct:
          normalizedOverrides[activeBlock.key]?.xPct ?? activeBlock.xPct,
        currentYPct:
          normalizedOverrides[activeBlock.key]?.yPct ?? activeBlock.yPct,
        baseXPct: activeBlock.xPct,
        baseYPct: activeBlock.yPct,
      }
    : null;
  const dragStateRef = useRef<{
    key: MissionBannerLayoutBlockKey;
    startX: number;
    startY: number;
    baseXPct: number;
    baseYPct: number;
    moved: boolean;
  } | null>(null);
  const suppressNextClickRef = useRef(false);

  const getCurrentBlockText = (block: TextBlockDefinition) => {
    const override = normalizedOverrides[block.key];
    return override?.textOverride ?? block.text;
  };

  const getRecommendedFontSizePx = (block: TextBlockDefinition) =>
    fitTextToWidth(
      getCurrentBlockText(block),
      block.maxWidth,
      block.minFontSize,
      Math.max(block.fontSizeBase, block.minFontSize),
    );

  const getCurrentFontSizePx = (block: TextBlockDefinition) => {
    const recommendedFontSize = getRecommendedFontSizePx(block);
    const current = normalizedOverrides[block.key];
    if (typeof current?.fontSizePx === 'number' && Number.isFinite(current.fontSizePx)) {
      return clamp(current.fontSizePx, block.minFontSize, 180);
    }
    if (typeof current?.fontScale === 'number' && Number.isFinite(current.fontScale)) {
      return Math.max(
        block.minFontSize,
        recommendedFontSize * clamp(current.fontScale, 0.45, 1.8),
      );
    }
    return Math.max(block.minFontSize, recommendedFontSize);
  };

  const commonSelectedFontSizePx = useMemo(() => {
    if (!selectedBlocks.length) return null;
    const roundedValues = selectedBlocks.map((block) =>
      Math.round(getCurrentFontSizePx(block)),
    );
    const [first, ...rest] = roundedValues;
    return rest.every((value) => value === first) ? first : null;
  }, [selectedBlocks, normalizedOverrides, blocks]);

  const activeBlockColor = activeBlock
    ? normalizedOverrides[activeBlock.key]?.colorHex ?? activeBlock.defaultColor
    : COLOR_PINK;

  useEffect(() => {
    if (commonSelectedFontSizePx === null) {
      setFontSizeInputValue('');
      return;
    }
    setFontSizeInputValue(String(commonSelectedFontSizePx));
  }, [commonSelectedFontSizePx]);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      if (!dragStateRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const deltaX = event.clientX - dragStateRef.current.startX;
      const deltaY = event.clientY - dragStateRef.current.startY;
      if (!dragStateRef.current.moved && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
        dragStateRef.current.moved = true;
      }
      const deltaXPct = deltaX / rect.width;
      const deltaYPct = deltaY / rect.height;
      onChange({
        ...normalizedOverrides,
        [dragStateRef.current.key]: {
          ...(normalizedOverrides[dragStateRef.current.key] ?? {}),
          xPct: clamp(dragStateRef.current.baseXPct + deltaXPct, 0.05, 0.92),
          yPct: clamp(dragStateRef.current.baseYPct + deltaYPct, 0.05, 0.95),
        },
      });
    };

    const handleUp = () => {
      if (dragStateRef.current?.moved) {
        suppressNextClickRef.current = true;
      }
      dragStateRef.current = null;
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [normalizedOverrides, onChange]);

  const handleStartDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
    block: TextBlockDefinition,
  ) => {
    if (!containerRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedBlock(block.key);
    const override = normalizedOverrides[block.key];
    dragStateRef.current = {
      key: block.key,
      startX: event.clientX,
      startY: event.clientY,
      baseXPct: override?.xPct ?? block.xPct,
      baseYPct: override?.yPct ?? block.yPct,
      moved: false,
    };
  };

  const updateBlocks = (
    keys: MissionBannerLayoutBlockKey[],
    patch:
      | MissionBannerLayoutBlockOverride
      | ((block: TextBlockDefinition) => MissionBannerLayoutBlockOverride),
  ) => {
    if (!keys.length) return;
    const next = { ...normalizedOverrides };
    for (const key of keys) {
      const block = visibleBlocks.find((item) => item.key === key);
      if (!block) continue;
      const resolvedPatch = typeof patch === 'function' ? patch(block) : patch;
      const current = next[key] ?? {};
      const merged: MissionBannerLayoutBlockOverride = {
        ...current,
        ...resolvedPatch,
      };
      if (resolvedPatch.fontScale === undefined && 'fontScale' in resolvedPatch) {
        delete merged.fontScale;
      }
      if (resolvedPatch.fontSizePx === undefined && 'fontSizePx' in resolvedPatch) {
        delete merged.fontSizePx;
      }
      if (resolvedPatch.colorHex === undefined && 'colorHex' in resolvedPatch) {
        delete merged.colorHex;
      }
      if (resolvedPatch.textOverride === undefined && 'textOverride' in resolvedPatch) {
        delete merged.textOverride;
      }
      if (Object.keys(merged).length > 0) {
        next[key] = merged;
      } else {
        delete next[key];
      }
    }
    onChange(next);
  };

  const setSingleSelection = (key: MissionBannerLayoutBlockKey) => {
    setSelectedBlock(key);
    setSelectedBlockKeys([key]);
  };

  const toggleBlockSelection = (key: MissionBannerLayoutBlockKey) => {
    setSelectedBlock(key);
    setSelectedBlockKeys((current) => {
      if (current.includes(key)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== key);
      }
      return [...current, key];
    });
  };

  const resetSelectedBlocks = () => {
    if (!selectedBlockKeys.length) return;
    const next = { ...normalizedOverrides };
    for (const key of selectedBlockKeys) {
      delete next[key];
    }
    onChange(next);
  };

  const resetAll = () => onChange({});

  const nudgeSelectedBlock = (axis: 'xPct' | 'yPct', delta: number) => {
    if (!selectedBlockKeys.length) return;
    updateBlocks(selectedBlockKeys, (block) => {
      const current = normalizedOverrides[block.key];
      const baseValue = axis === 'xPct' ? block.xPct : block.yPct;
      const currentValue =
        axis === 'xPct' ? current?.xPct ?? baseValue : current?.yPct ?? baseValue;
      return {
        [axis]:
          axis === 'xPct'
            ? clamp(currentValue + delta, 0.05, 0.92)
            : clamp(currentValue + delta, 0.05, 0.95),
      };
    });
  };

  const setSelectedBlockText = (nextText: string) => {
    if (!activeBlock) return;
    const normalized = nextText
      .split('\n')
      .map((line) => sanitizeLine(line))
      .join('\n');
    const defaultText = activeBlock.text;
    const hasMeaningfulText = normalized.trim().length > 0;
    updateBlocks([activeBlock.key], {
      textOverride:
        hasMeaningfulText && normalized !== defaultText ? normalized : undefined,
    });
  };

  const setSelectedBlockColor = (colorHex: string | undefined) => {
    if (!selectedBlockKeys.length) return;
    updateBlocks(selectedBlockKeys, { colorHex });
  };

  const applyFontSizeToSelection = (nextFontSizePx: number) => {
    if (!selectedBlockKeys.length) return;
    updateBlocks(selectedBlockKeys, (block) => ({
      fontSizePx: clamp(nextFontSizePx, block.minFontSize, 180),
      fontScale: undefined,
    }));
  };

  const nudgeSelectionFontSize = (delta: number) => {
    if (!selectedBlockKeys.length) return;
    updateBlocks(selectedBlockKeys, (block) => ({
      fontSizePx: clamp(getCurrentFontSizePx(block) + delta, block.minFontSize, 180),
      fontScale: undefined,
    }));
  };

  const matchSelectionToActiveFontSize = () => {
    if (!activeBlock || !selectedBlockKeys.length) return;
    applyFontSizeToSelection(getCurrentFontSizePx(activeBlock));
  };

  const copyActiveStyle = () => {
    if (!activeBlock) return;
    setStyleClipboard({
      fontSizePx: getCurrentFontSizePx(activeBlock),
      colorHex: activeBlockColor.toUpperCase(),
    });
    setFormatPainterArmed(false);
  };

  const applyClipboardToKeys = (keys: MissionBannerLayoutBlockKey[]) => {
    if (!styleClipboard || !keys.length) return;
    updateBlocks(keys, {
      fontSizePx: styleClipboard.fontSizePx,
      colorHex: styleClipboard.colorHex,
      fontScale: undefined,
    });
  };

  const handleToolbarFontSizeChange = (rawValue: string) => {
    setFontSizeInputValue(rawValue);
    const nextValue = Number(rawValue);
    if (!Number.isFinite(nextValue)) return;
    applyFontSizeToSelection(nextValue);
  };

  const commitFontSizeInput = () => {
    const nextValue = Number(fontSizeInputValue);
    if (!Number.isFinite(nextValue)) {
      setFontSizeInputValue(commonSelectedFontSizePx ? String(commonSelectedFontSizePx) : '');
      return;
    }
    applyFontSizeToSelection(nextValue);
    setFontSizeInputValue(String(Math.round(nextValue)));
  };

  useEffect(() => {
    if (!editingTextBlockKey) return;
    const editingBlock = visibleBlocks.find((block) => block.key === editingTextBlockKey);
    setInlineEditorValue(editingBlock ? getCurrentBlockText(editingBlock) : '');
  }, [editingTextBlockKey, visibleBlocks]);

  useEffect(() => {
    if (!activeBlock) return;
    setColorInputValue(activeBlockColor.toUpperCase());
  }, [activeBlock, activeBlockColor]);

  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        Arraste os blocos de texto na prévia e ajuste o tamanho conforme necessário. Os
        ajustes ficam salvos no banner e valem para o PNG/PDF final. Clique no texto
        já selecionado para editar e use Enter para quebrar a linha.
      </Typography>

      <Box
        ref={containerRef}
        sx={{
          position: 'relative',
          width: '100%',
          maxWidth: 360,
          aspectRatio: `${TEMPLATE_WIDTH} / ${TEMPLATE_HEIGHT}`,
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          backgroundImage: `url(${bannerTemplateImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          boxShadow: '0 18px 40px rgba(15, 23, 42, 0.18)',
          mx: 'auto',
          userSelect: 'none',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            left: '58%',
            top: '45%',
            width: '33%',
            height: '46%',
            border: '1px dashed rgba(255,255,255,0.18)',
            borderRadius: 2,
            pointerEvents: 'none',
          }}
        />
        {activeGuidePosition ? (
          <>
            <Box
              sx={{
                position: 'absolute',
                left: `${activeGuidePosition.baseXPct * 100}%`,
                top: '0%',
                width: '1px',
                height: '100%',
                backgroundColor: 'rgba(255,255,255,0.14)',
                borderLeft: '1px dashed rgba(255,255,255,0.22)',
                pointerEvents: 'none',
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                left: '0%',
                top: `${activeGuidePosition.baseYPct * 100}%`,
                width: '100%',
                height: '1px',
                backgroundColor: 'rgba(255,255,255,0.14)',
                borderTop: '1px dashed rgba(255,255,255,0.22)',
                pointerEvents: 'none',
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                left: `${activeGuidePosition.currentXPct * 100}%`,
                top: '0%',
                width: '1px',
                height: '100%',
                backgroundColor: 'rgba(121, 196, 255, 0.72)',
                boxShadow: '0 0 0 1px rgba(15, 23, 42, 0.08)',
                pointerEvents: 'none',
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                left: '0%',
                top: `${activeGuidePosition.currentYPct * 100}%`,
                width: '100%',
                height: '1px',
                backgroundColor: 'rgba(121, 196, 255, 0.72)',
                boxShadow: '0 0 0 1px rgba(15, 23, 42, 0.08)',
                pointerEvents: 'none',
              }}
            />
            <Chip
              size="small"
              label={`${Math.round(activeGuidePosition.currentXPct * 100)}% · ${Math.round(activeGuidePosition.currentYPct * 100)}%`}
              sx={{
                position: 'absolute',
                top: 10,
                right: 10,
                height: 22,
                bgcolor: 'rgba(15, 23, 42, 0.62)',
                color: '#fff',
                fontWeight: 700,
                pointerEvents: 'none',
                '& .MuiChip-label': {
                  px: 1,
                },
              }}
            />
          </>
        ) : null}
        {visibleBlocks.map((block) => {
          const override = normalizedOverrides[block.key];
          const xPct = override?.xPct ?? block.xPct;
          const yPct = override?.yPct ?? block.yPct;
          const sourceFontSizePx = getCurrentFontSizePx(block);
          const displayText = getCurrentBlockText(block);
          const fontSize =
            dimensions.width > 0
              ? (sourceFontSizePx / TEMPLATE_WIDTH) * dimensions.width
              : sourceFontSizePx;
          const currentColor = override?.colorHex ?? block.defaultColor;
          const isEditingInline = editingTextBlockKey === block.key;
          return (
            <Box
              key={block.key}
              onPointerDown={(event) => handleStartDrag(event, block)}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (suppressNextClickRef.current) {
                  suppressNextClickRef.current = false;
                  return;
                }
                if (formatPainterArmed && styleClipboard) {
                  setSingleSelection(block.key);
                  applyClipboardToKeys([block.key]);
                  setFormatPainterArmed(false);
                  return;
                }
                if (event.metaKey || event.ctrlKey || event.shiftKey) {
                  toggleBlockSelection(block.key);
                  return;
                }
                setSingleSelection(block.key);
              }}
              onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setSingleSelection(block.key);
                setEditingTextBlockKey(block.key);
                setInlineEditorValue(getCurrentBlockText(block));
              }}
              sx={{
                position: 'absolute',
                left: `${xPct * 100}%`,
                top: `${yPct * 100}%`,
                fontSize,
                fontFamily: BANNER_FONT_FAMILY,
                color: currentColor,
                fontWeight: block.fontWeight,
                lineHeight: 1.04,
                transform: 'translate(0, 0)',
                cursor: 'grab',
                borderRadius: 1,
                px: 0.4,
                py: 0.15,
                whiteSpace: 'pre',
                outline:
                  selectedBlockKeys.includes(block.key)
                    ? '1px dashed rgba(255,255,255,0.78)'
                    : 'none',
                backgroundColor:
                  selectedBlockKeys.includes(block.key)
                    ? 'rgba(15, 23, 42, 0.18)'
                    : 'transparent',
                textShadow: '0 1px 2px rgba(15, 23, 42, 0.12)',
              }}
            >
              {isEditingInline ? (
                <Box
                  component="textarea"
                  autoFocus
                  value={inlineEditorValue}
                  onChange={(event) => setInlineEditorValue(event.target.value)}
                  onBlur={() => {
                    setSelectedBlockText(inlineEditorValue);
                    setEditingTextBlockKey(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setEditingTextBlockKey(null);
                    }
                  }}
                  sx={{
                    minWidth: 120,
                    maxWidth: `${(block.maxWidth / TEMPLATE_WIDTH) * 100}%`,
                    border: '1px solid rgba(255,255,255,0.35)',
                    borderRadius: 1,
                    bgcolor: 'rgba(15, 23, 42, 0.72)',
                    color: '#fff',
                    fontFamily: BANNER_FONT_FAMILY,
                    fontSize: 'inherit',
                    fontWeight: 'inherit',
                    p: 0.6,
                    lineHeight: 1.05,
                    resize: 'both',
                    outline: 'none',
                  }}
                />
              ) : (
                displayText
              )}
            </Box>
          );
        })}
      </Box>

      <Stack spacing={1}>
        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            bgcolor: 'background.paper',
            px: 1.2,
            py: 1,
          }}
        >
          <Stack spacing={1}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1}
              alignItems={{ xs: 'stretch', md: 'center' }}
              justifyContent="space-between"
            >
              <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  color="primary"
                  variant="outlined"
                  label={
                    selectedBlocks.length === 1
                      ? `1 item selecionado`
                      : `${selectedBlocks.length} itens selecionados`
                  }
                />
                <Typography variant="caption" color="text.secondary">
                  Ctrl/⌘ clique para multisselecionar. Ajustes de estilo valem para toda a seleção.
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.6} alignItems="center" flexWrap="wrap" useFlexGap>
                <Tooltip title="Copiar formatação do bloco ativo">
                  <span>
                    <IconButton size="small" onClick={copyActiveStyle} disabled={!activeBlock}>
                      <ContentCopyRoundedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip
                  title={
                    formatPainterArmed
                      ? 'Clique em outro bloco para aplicar a formatação copiada'
                      : 'Pincel de formatação'
                  }
                >
                  <span>
                    <IconButton
                      size="small"
                      color={formatPainterArmed ? 'primary' : 'default'}
                      onClick={() => {
                        if (!activeBlock) return;
                        setStyleClipboard({
                          fontSizePx: getCurrentFontSizePx(activeBlock),
                          colorHex: activeBlockColor.toUpperCase(),
                        });
                        setFormatPainterArmed((current) => !current);
                      }}
                      disabled={!activeBlock}
                    >
                      <FormatPaintOutlinedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Aplicar a formatação copiada na seleção atual">
                  <span>
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => applyClipboardToKeys(selectedBlockKeys)}
                      disabled={!styleClipboard || !selectedBlockKeys.length}
                    >
                      Aplicar estilo
                    </Button>
                  </span>
                </Tooltip>
              </Stack>
            </Stack>

            <Divider flexItem />

            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1}
              alignItems={{ xs: 'stretch', md: 'center' }}
              flexWrap="wrap"
              useFlexGap
            >
              <Stack direction="row" spacing={0.6} alignItems="center">
                <Tooltip title="Diminuir 1 px">
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => nudgeSelectionFontSize(-1)}
                      disabled={!selectedBlockKeys.length}
                    >
                      <RemoveRoundedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <TextField
                  size="small"
                  label="Fonte"
                  value={fontSizeInputValue}
                  onChange={(event) => handleToolbarFontSizeChange(event.target.value)}
                  onBlur={commitFontSizeInput}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitFontSizeInput();
                    }
                  }}
                  placeholder={hasMultipleSelection ? 'Misto' : '0'}
                  type="number"
                  sx={{ width: 110 }}
                  inputProps={{ min: 8, max: 180, step: 1 }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">px</InputAdornment>,
                  }}
                />
                <Tooltip title="Aumentar 1 px">
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => nudgeSelectionFontSize(1)}
                      disabled={!selectedBlockKeys.length}
                    >
                      <AddRoundedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>

              <Tooltip title="Aplicar o tamanho do bloco ativo para toda a seleção">
                <span>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={matchSelectionToActiveFontSize}
                    disabled={!hasMultipleSelection || !activeBlock}
                  >
                    Igualar ao ativo
                  </Button>
                </span>
              </Tooltip>

              <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
                <Box
                  component="label"
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: 1.2,
                    border: '1px solid rgba(15, 23, 42, 0.18)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: '#fff',
                  }}
                >
                  <Box
                    component="input"
                    type="color"
                    value={normalizeHexColorInput(colorInputValue) ?? COLOR_PINK}
                    onChange={(event) => {
                      const next = normalizeHexColorInput(event.target.value) ?? COLOR_PINK;
                      setColorInputValue(next);
                      setSelectedBlockColor(next);
                    }}
                    sx={{
                      width: 44,
                      height: 44,
                      border: 'none',
                      p: 0,
                      m: -0.5,
                      bgcolor: 'transparent',
                      cursor: 'pointer',
                    }}
                  />
                </Box>
                <TextField
                  size="small"
                  label="Cor"
                  value={colorInputValue}
                  onChange={(event) => setColorInputValue(event.target.value)}
                  onBlur={() => {
                    const normalized = normalizeHexColorInput(colorInputValue);
                    if (!normalized) {
                      setColorInputValue(activeBlockColor.toUpperCase());
                      return;
                    }
                    setColorInputValue(normalized);
                    setSelectedBlockColor(normalized);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      const normalized = normalizeHexColorInput(colorInputValue);
                      if (!normalized) return;
                      setColorInputValue(normalized);
                      setSelectedBlockColor(normalized);
                    }
                  }}
                  placeholder="#F6C3CF"
                  sx={{ width: 142 }}
                />
                {bannerColorPalette.map((color) => {
                  const selected = activeBlockColor.toUpperCase() === color.toUpperCase();
                  return (
                    <Box
                      key={color}
                      component="button"
                      type="button"
                      onClick={() => setSelectedBlockColor(color)}
                      sx={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        border: selected
                          ? '2px solid rgba(15, 23, 42, 0.88)'
                          : '1px solid rgba(15, 23, 42, 0.22)',
                        bgcolor: color,
                        cursor: 'pointer',
                      }}
                    />
                  );
                })}
                <Button size="small" variant="text" onClick={() => setSelectedBlockColor(undefined)}>
                  Cor padrão
                </Button>
              </Stack>

              <Stack direction="row" spacing={0.6} alignItems="center" flexWrap="wrap" useFlexGap>
                <Button size="small" variant="outlined" onClick={() => nudgeSelectedBlock('xPct', -0.01)}>
                  ←
                </Button>
                <Button size="small" variant="outlined" onClick={() => nudgeSelectedBlock('yPct', -0.01)}>
                  ↑
                </Button>
                <Button size="small" variant="outlined" onClick={() => nudgeSelectedBlock('yPct', 0.01)}>
                  ↓
                </Button>
                <Button size="small" variant="outlined" onClick={() => nudgeSelectedBlock('xPct', 0.01)}>
                  →
                </Button>
              </Stack>

              <Stack direction="row" spacing={0.6} alignItems="center" flexWrap="wrap" useFlexGap>
                <Button
                  size="small"
                  variant="text"
                  startIcon={<RestartAltRoundedIcon />}
                  onClick={resetSelectedBlocks}
                >
                  Resetar seleção
                </Button>
                <Button size="small" variant="text" color="inherit" onClick={resetAll}>
                  Resetar layout
                </Button>
              </Stack>
            </Stack>
          </Stack>
        </Box>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={0.8}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
        >
          <Typography variant="caption" color="text.secondary">
            Linhas azuis mostram a posição atual do bloco ativo. Linhas tracejadas mostram a posição base do layout.
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          Blocos do banner
        </Typography>
        <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
          {visibleBlocks.map((block) => (
            <Chip
              key={block.key}
              size="small"
              clickable
              color={selectedBlockKeys.includes(block.key) ? 'primary' : 'default'}
              variant={selectedBlockKeys.includes(block.key) ? 'filled' : 'outlined'}
              label={block.label}
              onClick={() => setSingleSelection(block.key)}
            />
          ))}
        </Stack>
      </Stack>

      {activeBlock ? (
        <Stack spacing={1.2}>
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              Ajustando
            </Typography>
            <Typography variant="body2" fontWeight={700}>
              {hasMultipleSelection
                ? `${activeBlock.label} + ${selectedBlocks.length - 1} item(ns)`
                : activeBlock.label}
            </Typography>
          </Box>
          {hasMultipleSelection ? (
            <Typography variant="caption" color="text.secondary">
              Os controles acima já estão aplicando fonte, cor e posição para toda a seleção.
              Para editar texto, selecione apenas um bloco.
            </Typography>
          ) : (
            <TextField
              size="small"
              label="Texto do bloco"
              value={getCurrentBlockText(activeBlock)}
              onChange={(event) => setSelectedBlockText(event.target.value)}
              multiline
              minRows={2}
              helperText='Use Enter para quebrar linha. Duplo clique no texto da imagem também abre edição inline.'
              fullWidth
            />
          )}
        </Stack>
      ) : null}
    </Stack>
  );
}
