import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { throwError } from '../common/http-error';

export const CPCA_PRESIDENT_BULLETIN_MAX_SIZE_BYTES = 10 * 1024 * 1024;

type BulletinDetectedKind = 'pdf' | 'png' | 'jpeg';

type BulletinTypeConfig = {
  extension: string;
  extensions: string[];
  mimeType: string;
  mimeTypes: string[];
};

const BULLETIN_TYPE_CONFIG: Record<BulletinDetectedKind, BulletinTypeConfig> = {
  pdf: {
    extension: '.pdf',
    extensions: ['.pdf'],
    mimeType: 'application/pdf',
    mimeTypes: ['application/pdf'],
  },
  png: {
    extension: '.png',
    extensions: ['.png'],
    mimeType: 'image/png',
    mimeTypes: ['image/png'],
  },
  jpeg: {
    extension: '.jpg',
    extensions: ['.jpg', '.jpeg'],
    mimeType: 'image/jpeg',
    mimeTypes: ['image/jpeg', 'image/pjpeg'],
  },
};

const legacyBulletinDirs = [
  path.resolve(process.cwd(), 'storage', 'cpca-president-bulletins'),
  '/opt/gestao-projetos/backend/storage/cpca-president-bulletins',
  '/home/sddm/gestor-projetos-fab/backend/storage/cpca-president-bulletins',
];

export type StoredCpcaPresidentBulletinFile = {
  fileName: string;
  storageKey: string;
  mimeType: string;
  fileSize: number;
  checksum: string;
};

type ValidatedCpcaPresidentBulletinFile = StoredCpcaPresidentBulletinFile & {
  buffer: Buffer;
};

export function getCpcaPresidentBulletinsDir() {
  const configured =
    process.env.CPCA_PRESIDENT_BULLETINS_DIR?.trim() ||
    '/opt/gestao-projetos-data/cpca-president-bulletins';
  if (!fs.existsSync(configured)) {
    fs.mkdirSync(configured, { recursive: true });
  }
  return configured;
}

export function resolveExistingCpcaPresidentBulletinPath(storageKey: string) {
  const safeName = path.basename(String(storageKey ?? '').trim());
  if (!safeName) return '';
  const candidates = [
    path.join(getCpcaPresidentBulletinsDir(), safeName),
    ...legacyBulletinDirs.map((dir) => path.join(dir, safeName)),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

export function deleteCpcaPresidentBulletinFile(
  storageKey: string | null | undefined,
) {
  const filePath = resolveExistingCpcaPresidentBulletinPath(
    String(storageKey ?? ''),
  );
  if (!filePath) return false;
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

export function validateCpcaPresidentBulletinUpload(
  file: Express.Multer.File | undefined | null,
): ValidatedCpcaPresidentBulletinFile {
  if (!file) {
    throwError('VALIDATION_ERROR', {
      reason: 'CPCA_PRESIDENT_BULLETIN_FILE_REQUIRED',
    });
  }

  const buffer = file.buffer;
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throwError('VALIDATION_ERROR', {
      reason: 'CPCA_PRESIDENT_BULLETIN_FILE_REQUIRED',
    });
  }
  if (buffer.length > CPCA_PRESIDENT_BULLETIN_MAX_SIZE_BYTES) {
    throwError('FILE_TOO_LARGE', {
      reason: 'CPCA_PRESIDENT_BULLETIN_FILE_TOO_LARGE',
      maxBytes: CPCA_PRESIDENT_BULLETIN_MAX_SIZE_BYTES,
    });
  }

  const safeOriginalName = sanitizeOriginalFileName(file.originalname);
  const extension = path.extname(safeOriginalName).toLowerCase();
  const declaredMimeType = String(file.mimetype ?? '')
    .trim()
    .toLowerCase();

  const detectedKind = detectBulletinKind(buffer);
  if (!detectedKind) {
    throwError('FILE_TYPE_INVALID', {
      reason: 'CPCA_PRESIDENT_BULLETIN_MAGIC_INVALID',
    });
  }

  const typeConfig = BULLETIN_TYPE_CONFIG[detectedKind];

  if (!typeConfig.extensions.includes(extension)) {
    throwError('FILE_TYPE_INVALID', {
      reason: 'CPCA_PRESIDENT_BULLETIN_EXTENSION_MISMATCH',
      detectedKind,
      expectedExtensions: typeConfig.extensions,
    });
  }

  if (!typeConfig.mimeTypes.includes(declaredMimeType)) {
    throwError('FILE_TYPE_INVALID', {
      reason: 'CPCA_PRESIDENT_BULLETIN_MIME_MISMATCH',
      detectedKind,
      expectedMimeTypes: typeConfig.mimeTypes,
    });
  }

  return {
    fileName: safeOriginalName || `publicacao-cpca${typeConfig.extension}`,
    storageKey: `${Date.now()}-${randomUUID()}${typeConfig.extension}`,
    mimeType: typeConfig.mimeType,
    fileSize: buffer.length,
    checksum: createHash('sha256').update(buffer).digest('hex'),
    buffer,
  };
}

export function persistCpcaPresidentBulletinFile(
  file: ValidatedCpcaPresidentBulletinFile,
) {
  const destination = path.join(
    getCpcaPresidentBulletinsDir(),
    file.storageKey,
  );
  fs.writeFileSync(destination, file.buffer, { flag: 'wx' });
  return {
    fileName: file.fileName,
    storageKey: file.storageKey,
    mimeType: file.mimeType,
    fileSize: file.fileSize,
    checksum: file.checksum,
  } satisfies StoredCpcaPresidentBulletinFile;
}

function sanitizeOriginalFileName(value: string | null | undefined) {
  const normalized = path
    .basename(String(value ?? '').trim())
    .replace(/[\u0000-\u001f\u007f]+/g, '')
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  const limited = normalized.slice(0, 180);
  if (limited) return limited;
  return 'publicacao-cpca.pdf';
}

function detectBulletinKind(buffer: Buffer): BulletinDetectedKind | null {
  if (
    buffer.length >= 5 &&
    buffer.subarray(0, 5).toString('ascii') === '%PDF-'
  ) {
    return 'pdf';
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'jpeg';
  }

  return null;
}
