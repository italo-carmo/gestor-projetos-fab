import fs from 'node:fs';
import path from 'node:path';

export type ErrorCodeEntry = {
  httpStatus: number;
  message: string;
  details?: Record<string, unknown>;
};

type ErrorCatalog = Record<string, ErrorCodeEntry>;

let cache: ErrorCatalog | null = null;

export function getErrorCatalog(): ErrorCatalog {
  if (cache) return cache;
  const catalogPath = path.resolve(process.cwd(), '..', 'ERROR_CODES.json');
  const raw = fs.readFileSync(catalogPath, 'utf-8');
  cache = JSON.parse(raw) as ErrorCatalog;
  return cache;
}

export function getErrorCode(code: string): ErrorCodeEntry {
  const catalog = getErrorCatalog();
  const entry = catalog[code];
  if (!entry) {
    return { httpStatus: 500, message: 'Erro interno.' };
  }
  return entry;
}
