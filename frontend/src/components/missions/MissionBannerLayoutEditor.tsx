import {
  Box,
  Button,
  Chip,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
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
  fontScale?: number;
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
  color: string;
  fontWeight: number;
  xPct: number;
  yPct: number;
  fontSizeBase: number;
  minFontSize: number;
  maxWidth: number;
};

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
  const units = estimateTextUnits(text);
  if (units <= 0) return maxSize;
  const idealFont = maxWidth / (units * safetyFactor);
  return Math.max(minSize, Math.min(maxSize, idealFont));
}

function textFitsWithinWidth(text: string, maxWidth: number, minSize: number) {
  return estimateTextUnits(text) * minSize * 1.16 <= maxWidth;
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
    if (typeof block.fontScale === 'number' && Number.isFinite(block.fontScale)) {
      next.fontScale = clamp(block.fontScale, 0.45, 1.8);
    }
    if (Object.keys(next).length > 0) {
      normalized[key] = next;
    }
  }
  return normalized;
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
        color: COLOR_PINK,
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
        color: COLOR_WHITE,
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
        color: COLOR_PINK,
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
        color: COLOR_WHITE,
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
        color: COLOR_PINK,
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
        color: COLOR_WHITE,
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
    if (!visibleBlocks.some((block) => block.key === selectedBlock)) {
      setSelectedBlock(visibleBlocks[0]?.key ?? 'locationPrimary');
    }
  }, [selectedBlock, visibleBlocks]);

  const activeBlock = visibleBlocks.find((block) => block.key === selectedBlock) ?? null;
  const dragStateRef = useRef<{
    key: MissionBannerLayoutBlockKey;
    startX: number;
    startY: number;
    baseXPct: number;
    baseYPct: number;
  } | null>(null);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      if (!dragStateRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const deltaXPct = (event.clientX - dragStateRef.current.startX) / rect.width;
      const deltaYPct = (event.clientY - dragStateRef.current.startY) / rect.height;
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
    };
  };

  const updateSelectedBlock = (patch: MissionBannerLayoutBlockOverride) => {
    if (!activeBlock) return;
    onChange({
      ...normalizedOverrides,
      [activeBlock.key]: {
        ...(normalizedOverrides[activeBlock.key] ?? {}),
        ...patch,
      },
    });
  };

  const resetSelectedBlock = () => {
    if (!activeBlock) return;
    const next = { ...normalizedOverrides };
    delete next[activeBlock.key];
    onChange(next);
  };

  const resetAll = () => onChange({});

  const nudgeSelectedBlock = (axis: 'xPct' | 'yPct', delta: number) => {
    if (!activeBlock) return;
    const current = normalizedOverrides[activeBlock.key];
    const baseValue = axis === 'xPct' ? activeBlock.xPct : activeBlock.yPct;
    const currentValue =
      axis === 'xPct' ? current?.xPct ?? baseValue : current?.yPct ?? baseValue;
    updateSelectedBlock({
      [axis]:
        axis === 'xPct'
          ? clamp(currentValue + delta, 0.05, 0.92)
          : clamp(currentValue + delta, 0.05, 0.95),
    });
  };

  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        Arraste os blocos de texto na prévia e ajuste o tamanho conforme necessário. Os
        ajustes ficam salvos no banner e valem para o PNG/PDF final.
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
        {visibleBlocks.map((block) => {
          const override = normalizedOverrides[block.key];
          const xPct = override?.xPct ?? block.xPct;
          const yPct = override?.yPct ?? block.yPct;
          const fontScale = override?.fontScale ?? 1;
          const baseFontPx =
            dimensions.width > 0
              ? (block.fontSizeBase / TEMPLATE_WIDTH) * dimensions.width
              : 14;
          const fontSize = Math.max(block.minFontSize, baseFontPx * fontScale);
          return (
            <Box
              key={block.key}
              onPointerDown={(event) => handleStartDrag(event, block)}
              sx={{
                position: 'absolute',
                left: `${xPct * 100}%`,
                top: `${yPct * 100}%`,
                fontSize,
                color: block.color,
                fontWeight: block.fontWeight,
                lineHeight: 1,
                transform: 'translate(0, 0)',
                cursor: 'grab',
                borderRadius: 1,
                px: 0.4,
                py: 0.15,
                maxWidth: `${(block.maxWidth / TEMPLATE_WIDTH) * 100}%`,
                overflowWrap: 'anywhere',
                outline:
                  selectedBlock === block.key
                    ? '1px dashed rgba(255,255,255,0.72)'
                    : 'none',
                backgroundColor:
                  selectedBlock === block.key
                    ? 'rgba(15, 23, 42, 0.18)'
                    : 'transparent',
                textShadow: '0 1px 2px rgba(15, 23, 42, 0.12)',
              }}
            >
              {block.text}
            </Box>
          );
        })}
      </Box>

      <Stack spacing={1}>
        <Typography variant="caption" color="text.secondary">
          Blocos do banner
        </Typography>
        <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
          {visibleBlocks.map((block) => (
            <Chip
              key={block.key}
              size="small"
              clickable
              color={selectedBlock === block.key ? 'primary' : 'default'}
              variant={selectedBlock === block.key ? 'filled' : 'outlined'}
              label={block.label}
              onClick={() => setSelectedBlock(block.key)}
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
              {activeBlock.label}
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              Tamanho da letra
            </Typography>
            <Slider
              value={(normalizedOverrides[activeBlock.key]?.fontScale ?? 1) * 100}
              min={45}
              max={180}
              step={5}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value}%`}
              onChange={(_, value) =>
                updateSelectedBlock({ fontScale: Number(value) / 100 })
              }
            />
          </Box>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
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
            <Button size="small" variant="text" onClick={resetSelectedBlock}>
              Resetar bloco
            </Button>
            <Button size="small" variant="text" color="inherit" onClick={resetAll}>
              Resetar layout
            </Button>
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  );
}
