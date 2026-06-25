import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { throwError } from '../common/http-error';

export const CPCA_EMAIL_ATTACHMENT_MAX_SIZE_BYTES = 20 * 1024 * 1024;

const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  '.csv',
  '.doc',
  '.docx',
  '.jpeg',
  '.jpg',
  '.pdf',
  '.png',
  '.ppt',
  '.pptx',
  '.txt',
  '.xls',
  '.xlsx',
  '.zip',
]);

const legacyAttachmentDirs = [
  path.resolve(process.cwd(), 'storage', 'cpca-email-attachments'),
  '/opt/gestao-projetos/backend/storage/cpca-email-attachments',
  '/home/sddm/gestor-projetos-fab/backend/storage/cpca-email-attachments',
];

export type StoredCpcaEmailAttachmentFile = {
  fileName: string;
  storageKey: string;
  mimeType: string;
  fileSize: number;
};

type ValidatedCpcaEmailAttachmentFile = StoredCpcaEmailAttachmentFile & {
  buffer: Buffer;
};

export function getCpcaEmailAttachmentsDir() {
  const configured =
    process.env.CPCA_EMAIL_ATTACHMENTS_DIR?.trim() ||
    '/opt/gestao-projetos-data/cpca-email-attachments';
  if (!fs.existsSync(configured)) {
    fs.mkdirSync(configured, { recursive: true });
  }
  return configured;
}

export function resolveExistingCpcaEmailAttachmentPath(storageKey: string) {
  const safeName = path.basename(String(storageKey ?? '').trim());
  if (!safeName) return '';
  const candidates = [
    path.join(getCpcaEmailAttachmentsDir(), safeName),
    ...legacyAttachmentDirs.map((dir) => path.join(dir, safeName)),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

export function deleteCpcaEmailAttachmentFile(
  storageKey: string | null | undefined,
) {
  const filePath = resolveExistingCpcaEmailAttachmentPath(
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

export function validateCpcaEmailAttachmentUpload(
  file: Express.Multer.File | undefined | null,
): ValidatedCpcaEmailAttachmentFile {
  if (!file) {
    throwError('VALIDATION_ERROR', {
      reason: 'CPCA_EMAIL_ATTACHMENT_REQUIRED',
    });
  }

  const buffer = file.buffer;
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throwError('VALIDATION_ERROR', {
      reason: 'CPCA_EMAIL_ATTACHMENT_REQUIRED',
    });
  }
  if (buffer.length > CPCA_EMAIL_ATTACHMENT_MAX_SIZE_BYTES) {
    throwError('FILE_TOO_LARGE', {
      reason: 'CPCA_EMAIL_ATTACHMENT_TOO_LARGE',
      maxBytes: CPCA_EMAIL_ATTACHMENT_MAX_SIZE_BYTES,
    });
  }

  const safeOriginalName = sanitizeOriginalFileName(file.originalname);
  const extension = path.extname(safeOriginalName).toLowerCase();
  if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(extension)) {
    throwError('FILE_TYPE_INVALID', {
      reason: 'CPCA_EMAIL_ATTACHMENT_EXTENSION_INVALID',
      allowedExtensions: Array.from(ALLOWED_ATTACHMENT_EXTENSIONS).sort(),
    });
  }

  return {
    fileName: safeOriginalName,
    storageKey: `${Date.now()}-${randomUUID()}${extension}`,
    mimeType:
      String(file.mimetype ?? '').trim() || 'application/octet-stream',
    fileSize: buffer.length,
    buffer,
  };
}

export function persistCpcaEmailAttachmentFile(
  file: ValidatedCpcaEmailAttachmentFile,
) {
  const destination = path.join(getCpcaEmailAttachmentsDir(), file.storageKey);
  fs.writeFileSync(destination, file.buffer, { flag: 'wx' });
  return {
    fileName: file.fileName,
    storageKey: file.storageKey,
    mimeType: file.mimeType,
    fileSize: file.fileSize,
  } satisfies StoredCpcaEmailAttachmentFile;
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
  return 'anexo.pdf';
}
