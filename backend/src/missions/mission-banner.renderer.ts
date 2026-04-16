import * as fs from 'node:fs';
import * as path from 'node:path';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';

export type MissionBannerRenderable = {
  id: string;
  name: string;
  eventDate: string;
  eventTime: string;
  locationPrimary: string;
  locationSecondary: string | null;
  layoutOverrides?: MissionBannerLayoutOverrides | null;
};

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

const templateCandidates = [
  path.resolve(__dirname, 'assets', 'cipavd-banner-template.jpg'),
  path.resolve(__dirname, '..', '..', 'missions', 'assets', 'cipavd-banner-template.jpg'),
  path.resolve(process.cwd(), 'src', 'missions', 'assets', 'cipavd-banner-template.jpg'),
  path.resolve(process.cwd(), 'dist', 'missions', 'assets', 'cipavd-banner-template.jpg'),
];

const colorPink = '#F6C3CF';
const colorWhite = '#FFFFFF';
const bannerFontFamily = 'Arial, Helvetica, sans-serif';

export function findMissionBannerTemplatePath() {
  for (const candidate of templateCandidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('MISSION_BANNER_TEMPLATE_NOT_FOUND');
}

export async function renderMissionBannerPng(
  banner: MissionBannerRenderable,
) {
  const templatePath = findMissionBannerTemplatePath();
  const baseImage = sharp(templatePath);
  const metadata = await baseImage.metadata();
  const width = metadata.width ?? 904;
  const height = metadata.height ?? 1280;
  const overlaySvg = buildMissionBannerOverlaySvg(width, height, banner);

  return baseImage
    .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

export async function renderMissionBannerPdf(
  banner: MissionBannerRenderable,
) {
  const pngBuffer = await renderMissionBannerPng(banner);
  const templatePath = findMissionBannerTemplatePath();
  const metadata = await sharp(templatePath).metadata();
  const width = metadata.width ?? 904;
  const height = metadata.height ?? 1280;
  const doc = new PDFDocument({
    autoFirstPage: false,
    size: [width, height],
    margin: 0,
  });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.addPage({ size: [width, height], margin: 0 });
  doc.image(pngBuffer, 0, 0, { width, height });
  doc.end();
  return done;
}

function buildMissionBannerOverlaySvg(
  width: number,
  height: number,
  banner: MissionBannerRenderable,
) {
  const dateParts = parseBannerDate(banner.eventDate);
  const weekdayLabel = formatWeekdayLabel(dateParts);
  const monthLabel = formatMonthLabel(dateParts.month);
  const dayLabel = String(dateParts.day);
  const timeLabel = banner.eventTime.replace(':', 'h');
  const layoutOverrides = normalizeMissionBannerLayoutOverrides(
    banner.layoutOverrides,
  );
  const dateTextWidth = width * 0.22;
  const timeTextWidth = width * 0.24;
  const locationTextWidth = width * 0.245;
  const location = resolveLocationLines(
    banner.locationPrimary,
    banner.locationSecondary,
    locationTextWidth,
  );

  const dayText = resolveBlockText(layoutOverrides.day, dayLabel);
  const monthText = resolveBlockText(layoutOverrides.month, monthLabel);
  const timeText = resolveBlockText(layoutOverrides.time, timeLabel);
  const weekdayText = resolveBlockText(layoutOverrides.weekday, weekdayLabel);
  const locationPrimaryText = resolveBlockText(
    layoutOverrides.locationPrimary,
    location.line1,
  );
  const locationSecondaryText = resolveBlockText(
    layoutOverrides.locationSecondary,
    location.line2,
  );

  const daySizing = fitTextToWidth(dayText, dateTextWidth, width * 0.074, width * 0.10);
  const monthSizing = fitTextToWidth(
    monthText,
    dateTextWidth,
    width * 0.038,
    width * 0.075,
  );
  const timeSizing = fitTextToWidth(timeText, timeTextWidth, width * 0.060, width * 0.10);
  const weekdaySizing = fitTextToWidth(
    weekdayText,
    timeTextWidth,
    width * 0.040,
    width * 0.075,
  );
  const locationPrimarySizing = fitTextToWidth(
    locationPrimaryText,
    locationTextWidth,
    width * 0.028,
    width * 0.086,
    1.42,
  );
  const locationSecondarySizing = fitTextToWidth(
    locationSecondaryText,
    locationTextWidth,
    width * 0.024,
    width * 0.072,
    1.34,
  );

  const dayBlock = applyMissionBannerLayoutOverride(
    {
      x: width * 0.632,
      y: height * 0.493,
      fontSize: daySizing.fontSize,
    },
    layoutOverrides.day,
    width,
    height,
  );
  const monthBlock = applyMissionBannerLayoutOverride(
    {
      x: width * 0.632,
      y: height * 0.553,
      fontSize: monthSizing.fontSize,
    },
    layoutOverrides.month,
    width,
    height,
  );
  const timeBlock = applyMissionBannerLayoutOverride(
    {
      x: width * 0.632,
      y: height * 0.632,
      fontSize: timeSizing.fontSize,
    },
    layoutOverrides.time,
    width,
    height,
  );
  const weekdayBlock = applyMissionBannerLayoutOverride(
    {
      x: width * 0.632,
      y: height * 0.694,
      fontSize: weekdaySizing.fontSize,
    },
    layoutOverrides.weekday,
    width,
    height,
  );
  const locationPrimaryBlock = applyMissionBannerLayoutOverride(
    {
      x: width * 0.632,
      y: height * 0.818,
      fontSize: locationPrimarySizing.fontSize,
    },
    layoutOverrides.locationPrimary,
    width,
    height,
  );
  const locationSecondaryBlock = applyMissionBannerLayoutOverride(
    {
      x: width * 0.632,
      y: height * 0.878,
      fontSize: locationSecondarySizing.fontSize,
    },
    layoutOverrides.locationSecondary,
    width,
    height,
  );

  const dayColor = resolveBlockColor(layoutOverrides.day, colorPink);
  const monthColor = resolveBlockColor(layoutOverrides.month, colorWhite);
  const timeColor = resolveBlockColor(layoutOverrides.time, colorPink);
  const weekdayColor = resolveBlockColor(layoutOverrides.weekday, colorWhite);
  const locationPrimaryColor = resolveBlockColor(
    layoutOverrides.locationPrimary,
    colorPink,
  );
  const locationSecondaryColor = resolveBlockColor(
    layoutOverrides.locationSecondary,
    colorWhite,
  );

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .banner-text { font-family: ${bannerFontFamily}; }
      </style>
      ${renderSvgTextBlock(dayText, {
        x: dayBlock.x,
        y: dayBlock.y,
        fontSize: dayBlock.fontSize,
        fontWeight: 700,
        colorHex: dayColor,
        maxWidth: dateTextWidth,
        hasManualFontSize: dayBlock.hasManualFontSize,
      })}
      ${renderSvgTextBlock(monthText, {
        x: monthBlock.x,
        y: monthBlock.y,
        fontSize: monthBlock.fontSize,
        fontWeight: 400,
        colorHex: monthColor,
        maxWidth: dateTextWidth,
        hasManualFontSize: monthBlock.hasManualFontSize,
      })}
      ${renderSvgTextBlock(timeText, {
        x: timeBlock.x,
        y: timeBlock.y,
        fontSize: timeBlock.fontSize,
        fontWeight: 700,
        colorHex: timeColor,
        maxWidth: timeTextWidth,
        hasManualFontSize: timeBlock.hasManualFontSize,
      })}
      ${renderSvgTextBlock(weekdayText, {
        x: weekdayBlock.x,
        y: weekdayBlock.y,
        fontSize: weekdayBlock.fontSize,
        fontWeight: 400,
        colorHex: weekdayColor,
        maxWidth: timeTextWidth,
        hasManualFontSize: weekdayBlock.hasManualFontSize,
      })}
      ${renderSvgTextBlock(locationPrimaryText, {
        x: locationPrimaryBlock.x,
        y: locationPrimaryBlock.y,
        fontSize: locationPrimaryBlock.fontSize,
        fontWeight: 700,
        colorHex: locationPrimaryColor,
        maxWidth: locationTextWidth,
        hasManualFontSize: locationPrimaryBlock.hasManualFontSize,
      })}
      ${
        locationSecondaryText
          ? renderSvgTextBlock(locationSecondaryText, {
              x: locationSecondaryBlock.x,
              y: locationSecondaryBlock.y,
              fontSize: locationSecondaryBlock.fontSize,
              fontWeight: 400,
              colorHex: locationSecondaryColor,
              maxWidth: locationTextWidth,
              hasManualFontSize: locationSecondaryBlock.hasManualFontSize,
            })
          : ''
      }
    </svg>
  `;
}

function parseBannerDate(value: string) {
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value);
  if (!match) {
    throw new Error('MISSION_BANNER_DATE_INVALID');
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
  const weekday = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(normalizedDate);
  return weekday.replace(/-feira$/i, '').toUpperCase();
}

function resolveLocationLines(
  primaryRaw: string,
  secondaryRaw: string | null,
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

function splitLocationTextIntoTwoLines(text: string) {
  const normalized = sanitizeLine(text);
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    return { line1: normalized, line2: '' };
  }

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

function sanitizeLine(value: string) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 120);
}

function normalizeMissionBannerLayoutOverrides(
  input: MissionBannerRenderable['layoutOverrides'],
) {
  const result: MissionBannerLayoutOverrides = {};
  if (!input || typeof input !== 'object') return result;

  for (const key of missionBannerLayoutKeys) {
    const raw =
      key in input && input[key] && typeof input[key] === 'object'
        ? (input[key] as Record<string, unknown>)
        : null;
    if (!raw) continue;
    const next: MissionBannerLayoutBlockOverride = {};
    if (typeof raw.xPct === 'number' && Number.isFinite(raw.xPct)) {
      next.xPct = clamp(raw.xPct, 0.05, 0.92);
    }
    if (typeof raw.yPct === 'number' && Number.isFinite(raw.yPct)) {
      next.yPct = clamp(raw.yPct, 0.05, 0.95);
    }
    if (typeof raw.fontSizePx === 'number' && Number.isFinite(raw.fontSizePx)) {
      next.fontSizePx = clamp(raw.fontSizePx, 8, 180);
    }
    if (typeof raw.fontScale === 'number' && Number.isFinite(raw.fontScale)) {
      next.fontScale = clamp(raw.fontScale, 0.45, 1.8);
    }
    if (
      typeof raw.colorHex === 'string' &&
      /^#([0-9a-f]{6})$/i.test(raw.colorHex.trim())
    ) {
      next.colorHex = raw.colorHex.trim().toUpperCase();
    }
    if (typeof raw.textOverride === 'string') {
      const textOverride = raw.textOverride
        .split('\n')
        .map((line) => sanitizeLine(line))
        .join('\n')
        .trim();
      if (textOverride) {
        next.textOverride = textOverride;
      }
    }
    if (Object.keys(next).length > 0) {
      result[key] = next;
    }
  }

  return result;
}

function applyMissionBannerLayoutOverride(
  base: { x: number; y: number; fontSize: number },
  override: MissionBannerLayoutBlockOverride | undefined,
  width: number,
  height: number,
): { x: number; y: number; fontSize: number; hasManualFontSize: boolean } {
  if (!override) {
    return {
      ...base,
      hasManualFontSize: false,
    };
  }
  const hasExplicitFontSize =
    typeof override.fontSizePx === 'number' && Number.isFinite(override.fontSizePx);
  return {
    x:
      typeof override.xPct === 'number'
        ? clamp(override.xPct, 0.05, 0.92) * width
        : base.x,
    y:
      typeof override.yPct === 'number'
        ? clamp(override.yPct, 0.05, 0.95) * height
        : base.y,
    fontSize:
      hasExplicitFontSize
        ? clamp(override.fontSizePx!, 8, 180)
        : typeof override.fontScale === 'number'
        ? Math.max(
            base.fontSize * 0.45,
            base.fontSize * clamp(override.fontScale, 0.45, 1.8),
          )
        : base.fontSize,
    hasManualFontSize: hasExplicitFontSize || typeof override.fontScale === 'number',
  };
}

function fitTextToWidth(
  text: string,
  maxWidth: number,
  minSize: number,
  maxSize: number,
  safetyFactor = 1.16,
) {
  if (!text) {
    return { fontSize: maxSize, constrained: false };
  }
  const units = getLongestLineUnits(text);
  if (units <= 0) {
    return { fontSize: maxSize, constrained: false };
  }
  const idealFont = maxWidth / (units * safetyFactor);
  return {
    fontSize: Math.max(minSize, Math.min(maxSize, idealFont)),
    constrained: idealFont < maxSize,
  };
}

function textFitsWithinWidth(text: string, maxWidth: number, minSize: number) {
  return getLongestLineUnits(text) * minSize * 1.16 <= maxWidth;
}

function estimateTextUnits(text: string) {
  const normalized = String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
      units += 0.40;
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

function buildSvgTextFitAttributes(
  text: string,
  maxWidth: number,
  block: { fontSize: number; hasManualFontSize?: boolean },
) {
  if (!text) return '';
  if (block.hasManualFontSize) return '';
  const estimatedWidth = getLongestLineUnits(text) * block.fontSize * 1.12;
  if (estimatedWidth <= maxWidth * 0.9) return '';
  return ` textLength="${maxWidth}" lengthAdjust="spacingAndGlyphs"`;
}

function resolveBlockText(
  override: MissionBannerLayoutBlockOverride | undefined,
  fallback: string,
) {
  const overrideText = override?.textOverride
    ?.split('\n')
    .map((line) => sanitizeLine(line))
    .join('\n')
    .trim();
  return overrideText || fallback;
}

function resolveBlockColor(
  override: MissionBannerLayoutBlockOverride | undefined,
  fallback: string,
) {
  if (
    typeof override?.colorHex === 'string' &&
    /^#([0-9a-f]{6})$/i.test(override.colorHex)
  ) {
    return override.colorHex.toUpperCase();
  }
  return fallback;
}

function renderSvgTextBlock(
  text: string,
  options: {
    x: number;
    y: number;
    fontSize: number;
    fontWeight: number;
    colorHex: string;
    maxWidth: number;
    hasManualFontSize?: boolean;
  },
) {
  const lines = String(text ?? '')
    .split('\n')
    .map((line) => sanitizeLine(line))
    .filter(Boolean);
  if (lines.length === 0) return '';

  if (lines.length === 1) {
    return `<text class="banner-text" fill="${escapeXml(
      options.colorHex,
    )}" x="${options.x}" y="${options.y}" font-size="${options.fontSize}" font-weight="${options.fontWeight}" dominant-baseline="text-before-edge"${buildSvgTextFitAttributes(
      lines[0],
      options.maxWidth,
      options,
    )}>${escapeXml(lines[0])}</text>`;
  }

  const lineHeightEm = 1.04;
  const tspans = lines
    .map((line, index) =>
      index === 0
        ? `<tspan x="${options.x}" y="${options.y}">${escapeXml(line)}</tspan>`
        : `<tspan x="${options.x}" dy="${lineHeightEm}em">${escapeXml(line)}</tspan>`,
    )
    .join('');

  return `<text class="banner-text" fill="${escapeXml(
    options.colorHex,
  )}" font-size="${options.fontSize}" font-weight="${options.fontWeight}" dominant-baseline="text-before-edge">${tspans}</text>`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function escapeXml(value: string) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
