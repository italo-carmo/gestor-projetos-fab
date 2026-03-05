import * as fs from 'node:fs';
import * as path from 'node:path';

const persistentBaseDir =
  process.env.SOCIAL_COMM_COVERS_DIR?.trim() ||
  '/opt/gestao-projetos-data/social-communication-covers';
const legacyBaseDir = path.resolve(
  process.cwd(),
  'storage',
  'social-communication-covers',
);

export function getSocialCommunicationCoversDir() {
  if (!fs.existsSync(persistentBaseDir)) {
    fs.mkdirSync(persistentBaseDir, { recursive: true });
  }
  return persistentBaseDir;
}

export function getSocialCommunicationCoverCandidates(fileName: string) {
  const safeName = path.basename(String(fileName ?? ''));
  return [
    path.resolve(getSocialCommunicationCoversDir(), safeName),
    path.resolve(legacyBaseDir, safeName),
  ];
}

