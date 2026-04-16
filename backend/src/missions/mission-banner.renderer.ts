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
};

const templateCandidates = [
  path.resolve(__dirname, 'assets', 'cipavd-banner-template.jpg'),
  path.resolve(__dirname, '..', '..', 'missions', 'assets', 'cipavd-banner-template.jpg'),
  path.resolve(process.cwd(), 'src', 'missions', 'assets', 'cipavd-banner-template.jpg'),
  path.resolve(process.cwd(), 'dist', 'missions', 'assets', 'cipavd-banner-template.jpg'),
];

const colorPink = '#F6C3CF';
const colorWhite = '#FFFFFF';

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
  const location = resolveLocationLines(
    banner.locationPrimary,
    banner.locationSecondary,
  );

  const dayFont = fitFontSize(dayLabel, width * 0.082, 2, width * 0.10);
  const monthFont = fitFontSize(monthLabel, width * 0.060, 9, width * 0.075);
  const timeFont = fitFontSize(timeLabel, width * 0.082, 6, width * 0.10);
  const weekdayFont = fitFontSize(
    weekdayLabel,
    width * 0.060,
    10,
    width * 0.075,
  );
  const locationPrimaryFont = fitFontSize(
    location.line1,
    width * 0.077,
    15,
    width * 0.086,
  );
  const locationSecondaryFont = fitFontSize(
    location.line2,
    width * 0.058,
    18,
    width * 0.072,
  );

  const calendarX = width * 0.632;
  const calendarDayY = height * 0.493;
  const calendarMonthY = height * 0.553;
  const timeY = height * 0.632;
  const weekdayY = height * 0.694;
  const locationPrimaryY = height * 0.818;
  const locationSecondaryY = height * 0.878;

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .pink { fill: ${colorPink}; font-family: Arial, Helvetica, sans-serif; font-weight: 700; }
        .white { fill: ${colorWhite}; font-family: Arial, Helvetica, sans-serif; font-weight: 400; }
      </style>
      <text class="pink" x="${calendarX}" y="${calendarDayY}" font-size="${dayFont}" dominant-baseline="text-before-edge">${escapeXml(dayLabel)}</text>
      <text class="white" x="${calendarX}" y="${calendarMonthY}" font-size="${monthFont}" dominant-baseline="text-before-edge">${escapeXml(monthLabel)}</text>
      <text class="pink" x="${calendarX}" y="${timeY}" font-size="${timeFont}" dominant-baseline="text-before-edge">${escapeXml(timeLabel)}</text>
      <text class="white" x="${calendarX}" y="${weekdayY}" font-size="${weekdayFont}" dominant-baseline="text-before-edge">${escapeXml(weekdayLabel)}</text>
      <text class="pink" x="${calendarX}" y="${locationPrimaryY}" font-size="${locationPrimaryFont}" dominant-baseline="text-before-edge">${escapeXml(location.line1)}</text>
      ${location.line2 ? `<text class="white" x="${calendarX}" y="${locationSecondaryY}" font-size="${locationSecondaryFont}" dominant-baseline="text-before-edge">${escapeXml(location.line2)}</text>` : ''}
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

function resolveLocationLines(primaryRaw: string, secondaryRaw: string | null) {
  const line1 = sanitizeLine(primaryRaw);
  const explicitLine2 = sanitizeLine(secondaryRaw ?? '');
  if (explicitLine2) {
    return { line1, line2: explicitLine2 };
  }

  if (line1.length <= 16 || !line1.includes(' ')) {
    return { line1, line2: '' };
  }

  const words = line1.split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    return { line1, line2: '' };
  }

  let bestIndex = 1;
  let smallestDelta = Number.POSITIVE_INFINITY;
  for (let index = 1; index < words.length; index += 1) {
    const left = words.slice(0, index).join(' ');
    const right = words.slice(index).join(' ');
    const delta = Math.abs(left.length - right.length);
    if (delta < smallestDelta) {
      smallestDelta = delta;
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

function fitFontSize(
  text: string,
  baseSize: number,
  softLimit: number,
  maxSize: number,
) {
  if (!text) return baseSize;
  if (text.length <= softLimit) {
    return Math.min(baseSize, maxSize);
  }
  const factor = softLimit / text.length;
  return Math.max(baseSize * 0.58, Math.min(baseSize * factor * 1.05, maxSize));
}

function escapeXml(value: string) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
