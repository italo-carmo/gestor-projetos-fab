import * as fs from 'node:fs';
import * as path from 'node:path';

const persistentDocumentsDir =
  process.env.LIBRARY_DOCUMENTS_DIR?.trim() ||
  '/opt/gestao-projetos-data/library-documents';

const legacyDocumentDirs = [
  path.resolve(process.cwd(), 'storage', 'library-documents'),
  '/opt/gestao-projetos/backend/storage/library-documents',
  '/home/sddm/gestor-projetos-fab/backend/storage/library-documents',
];

export function getLibraryDocumentsDir() {
  if (!fs.existsSync(persistentDocumentsDir)) {
    fs.mkdirSync(persistentDocumentsDir, { recursive: true });
  }
  return persistentDocumentsDir;
}

export function resolveExistingLibraryDocumentPath(fileName: string) {
  const safeName = path.basename(String(fileName ?? '').trim());
  if (!safeName) return '';
  const candidates = [path.join(getLibraryDocumentsDir(), safeName), ...legacyDocumentDirs.map((dir) => path.join(dir, safeName))];
  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}


