import * as fs from 'node:fs';
import * as path from 'node:path';

const defaultKnowledgeBaseDir = '/opt/gestao-projetos-data/knowledge-bases';

const legacyKnowledgeBaseDirs = [
  path.resolve(process.cwd(), 'storage', 'knowledge-bases'),
  '/opt/gestao-projetos/backend/storage/knowledge-bases',
  '/home/sddm/gestor-projetos-fab/backend/storage/knowledge-bases',
];

export function getKnowledgeBaseDocumentsDir() {
  const persistentKnowledgeBaseDir =
    process.env.KNOWLEDGE_BASE_DOCUMENTS_DIR?.trim() ||
    defaultKnowledgeBaseDir;
  if (!fs.existsSync(persistentKnowledgeBaseDir)) {
    fs.mkdirSync(persistentKnowledgeBaseDir, { recursive: true });
  }
  return persistentKnowledgeBaseDir;
}

export function resolveExistingKnowledgeBaseDocumentPath(fileName: string) {
  const safeName = path.basename(String(fileName ?? '').trim());
  if (!safeName) return '';
  const candidates = [
    path.join(getKnowledgeBaseDocumentsDir(), safeName),
    ...legacyKnowledgeBaseDirs.map((dir) => path.join(dir, safeName)),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}
