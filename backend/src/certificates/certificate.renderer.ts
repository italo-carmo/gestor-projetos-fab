import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';

const DEFAULT_WIDTH = 1123;
const DEFAULT_HEIGHT = 794;
const RECIPIENT_VARIABLE_KEY = 'recipient_full_name';

type CertificateLayout = {
  backgroundColor?: string;
  frameColor?: string;
  elements?: CertificateLayoutElement[];
};

type CertificateLayoutElement = {
  id?: string;
  type?: string;
  label?: string;
  text?: string;
  variableKey?: string;
  src?: string;
  alt?: string;
  xPct?: number;
  yPct?: number;
  widthPct?: number;
  zIndex?: number;
  visible?: boolean;
  opacity?: number;
  fontFamily?: string;
  fontSizePx?: number;
  fontWeight?: number;
  fontStyle?: string;
  colorHex?: string;
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;
  thicknessPx?: number;
  mixBlendMode?: string;
};

type RenderInput = {
  layoutJson: unknown;
  recipientFullName: string;
};

function escapeXml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function asFiniteNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeColor(value: unknown, fallback: string) {
  const raw = String(value ?? '').trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
  return fallback;
}

function estimateTextUnits(text: string) {
  let units = 0;
  for (const char of text) {
    if (char === ' ') units += 0.34;
    else if (/[ilIjtfr1]/u.test(char)) units += 0.4;
    else if (/[mwMWQO0@#%&]/u.test(char)) units += 0.92;
    else if (/[A-Z]/u.test(char)) units += 0.74;
    else units += 0.58;
  }
  return units;
}

function wrapText(text: string, maxWidth: number, fontSize: number) {
  const explicitLines = String(text ?? '').split('\n');
  const lines: string[] = [];
  for (const explicitLine of explicitLines) {
    const words = explicitLine.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (estimateTextUnits(candidate) * fontSize <= maxWidth || !current) {
        current = candidate;
        continue;
      }
      lines.push(current);
      current = word;
    }
    if (current) lines.push(current);
  }
  return lines;
}

function parseLayout(layoutJson: unknown): CertificateLayout {
  if (!layoutJson || typeof layoutJson !== 'object') {
    return { elements: [] };
  }
  return layoutJson as CertificateLayout;
}

function resolveAssetPath(src: string) {
  const normalized = src.replace(/^\/+/, '');
  const candidates = [
    path.resolve(process.cwd(), '..', 'frontend', 'public', normalized),
    path.resolve(process.cwd(), 'frontend', 'public', normalized),
    path.resolve(process.cwd(), 'public', normalized),
    path.resolve(__dirname, '..', '..', '..', 'frontend', 'public', normalized),
  ];
  return candidates;
}

async function loadImageDataUri(src: string) {
  if (!src) return null;
  if (src.startsWith('data:image/')) {
    const [, payload = ''] = src.split(',', 2);
    const mime = src.slice(5, src.indexOf(';'));
    const buffer = Buffer.from(payload, 'base64');
    const metadata = await sharp(buffer).metadata();
    return {
      dataUri: src,
      width: metadata.width ?? 1,
      height: metadata.height ?? 1,
    };
  }

  for (const candidate of resolveAssetPath(src)) {
    try {
      const buffer = await fs.readFile(candidate);
      const metadata = await sharp(buffer).metadata();
      const ext = path.extname(candidate).toLowerCase();
      const mime =
        ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : ext === '.webp'
            ? 'image/webp'
            : 'image/png';
      return {
        dataUri: `data:${mime};base64,${buffer.toString('base64')}`,
        width: metadata.width ?? 1,
        height: metadata.height ?? 1,
      };
    } catch {
      // Try next candidate.
    }
  }
  return null;
}

function renderTextElement(
  element: CertificateLayoutElement,
  width: number,
  recipientFullName: string,
) {
  const x = clamp(asFiniteNumber(element.xPct, 0) * width, 0, width);
  const y = clamp(asFiniteNumber(element.yPct, 0) * DEFAULT_HEIGHT, 0, DEFAULT_HEIGHT);
  const elementWidth = clamp(asFiniteNumber(element.widthPct, 0.2) * width, 20, width);
  const fontSize = clamp(asFiniteNumber(element.fontSizePx, 18), 6, 180);
  const lineHeight = clamp(asFiniteNumber(element.lineHeight, 1.2), 0.8, 2.4);
  const color = normalizeColor(element.colorHex, '#111111');
  const align = element.textAlign ?? 'left';
  const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
  const textX = align === 'center' ? x + elementWidth / 2 : align === 'right' ? x + elementWidth : x;
  const rawText =
    element.type === 'variable' && element.variableKey === RECIPIENT_VARIABLE_KEY
      ? recipientFullName
      : String(element.text ?? '');
  const lines = wrapText(rawText, elementWidth, fontSize);
  const fontFamily = String(element.fontFamily ?? 'Arial, Helvetica, sans-serif')
    .replace(/"/g, "'")
    .split(',')[0]
    .trim();
  const fontWeight = clamp(asFiniteNumber(element.fontWeight, 400), 100, 900);
  const fontStyle = element.fontStyle === 'italic' ? 'italic' : 'normal';
  const dy = fontSize * lineHeight;

  return `<text x="${textX}" y="${y + fontSize}" fill="${color}" font-family="${escapeXml(fontFamily)}" font-size="${fontSize}" font-weight="${fontWeight}" font-style="${fontStyle}" text-anchor="${anchor}" opacity="${clamp(asFiniteNumber(element.opacity, 1), 0, 1)}">${lines
    .map((line, index) =>
      `<tspan x="${textX}" dy="${index === 0 ? 0 : dy}">${escapeXml(line)}</tspan>`,
    )
    .join('')}</text>`;
}

function renderLineElement(element: CertificateLayoutElement, width: number) {
  const x = clamp(asFiniteNumber(element.xPct, 0) * width, 0, width);
  const y = clamp(asFiniteNumber(element.yPct, 0) * DEFAULT_HEIGHT, 0, DEFAULT_HEIGHT);
  const elementWidth = clamp(asFiniteNumber(element.widthPct, 0.2) * width, 4, width);
  const color = normalizeColor(element.colorHex, '#111111');
  const thickness = clamp(asFiniteNumber(element.thicknessPx, 1), 1, 12);
  return `<line x1="${x}" y1="${y}" x2="${x + elementWidth}" y2="${y}" stroke="${color}" stroke-width="${thickness}" opacity="${clamp(asFiniteNumber(element.opacity, 1), 0, 1)}" />`;
}

async function renderImageElement(element: CertificateLayoutElement, width: number) {
  const image = await loadImageDataUri(String(element.src ?? ''));
  if (!image) return '';
  const x = clamp(asFiniteNumber(element.xPct, 0) * width, 0, width);
  const y = clamp(asFiniteNumber(element.yPct, 0) * DEFAULT_HEIGHT, 0, DEFAULT_HEIGHT);
  const elementWidth = clamp(asFiniteNumber(element.widthPct, 0.15) * width, 4, width);
  const elementHeight = elementWidth * (image.height / Math.max(image.width, 1));
  return `<image href="${image.dataUri}" x="${x}" y="${y}" width="${elementWidth}" height="${elementHeight}" preserveAspectRatio="xMidYMid meet" opacity="${clamp(asFiniteNumber(element.opacity, 1), 0, 1)}" />`;
}

async function buildCertificateSvg(input: RenderInput) {
  const layout = parseLayout(input.layoutJson);
  const width = DEFAULT_WIDTH;
  const height = DEFAULT_HEIGHT;
  const backgroundColor = normalizeColor(layout.backgroundColor, '#F8F4EC');
  const frameColor = normalizeColor(layout.frameColor, '#8E642A');
  const elements = (layout.elements ?? [])
    .filter((element) => element && element.visible !== false)
    .slice()
    .sort((a, b) => asFiniteNumber(a.zIndex, 0) - asFiniteNumber(b.zIndex, 0));

  const renderedElements: string[] = [];
  for (const element of elements) {
    if (element.type === 'image') {
      renderedElements.push(await renderImageElement(element, width));
    } else if (element.type === 'line') {
      renderedElements.push(renderLineElement(element, width));
    } else if (element.type === 'text' || element.type === 'variable') {
      renderedElements.push(renderTextElement(element, width, input.recipientFullName));
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <pattern id="paper" width="46" height="40" patternUnits="userSpaceOnUse">
      <path d="M0 20 L46 0 M0 40 L46 20" stroke="rgba(91,93,84,0.09)" stroke-width="1" fill="none" />
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="${backgroundColor}" />
  <rect width="100%" height="100%" fill="url(#paper)" opacity="0.38" />
  <rect x="20" y="20" width="${width - 40}" height="${height - 40}" fill="none" stroke="${frameColor}" stroke-width="2" />
  <rect x="31" y="31" width="${width - 62}" height="${height - 62}" fill="none" stroke="${frameColor}" stroke-width="1" opacity="0.46" />
  <rect x="35" y="35" width="${width - 70}" height="${height - 70}" fill="none" stroke="${frameColor}" stroke-width="2" opacity="0.18" />
  <rect x="13" y="13" width="23" height="23" fill="${backgroundColor}" stroke="${frameColor}" stroke-width="2" />
  <rect x="${width - 36}" y="13" width="23" height="23" fill="${backgroundColor}" stroke="${frameColor}" stroke-width="2" />
  <rect x="13" y="${height - 36}" width="23" height="23" fill="${backgroundColor}" stroke="${frameColor}" stroke-width="2" />
  <rect x="${width - 36}" y="${height - 36}" width="23" height="23" fill="${backgroundColor}" stroke="${frameColor}" stroke-width="2" />
  ${renderedElements.join('\n')}
</svg>`;
}

export async function renderCertificatePng(input: RenderInput) {
  const svg = await buildCertificateSvg(input);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function renderCertificatePdf(input: RenderInput) {
  const png = await renderCertificatePng(input);
  const doc = new PDFDocument({
    autoFirstPage: false,
    size: [DEFAULT_WIDTH, DEFAULT_HEIGHT],
    margin: 0,
  });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  doc.addPage({ size: [DEFAULT_WIDTH, DEFAULT_HEIGHT], margin: 0 });
  doc.image(png, 0, 0, { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  doc.end();
  return done;
}
