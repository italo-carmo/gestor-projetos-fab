import * as fs from 'node:fs';
import * as path from 'node:path';

const defaultCipavdReportsDir = '/opt/gestao-projetos-data/cipavd-reports';

const legacyCipavdReportsDirs = [
  path.resolve(process.cwd(), 'storage', 'cipavd-reports'),
  '/opt/gestao-projetos/backend/storage/cipavd-reports',
  '/home/sddm/gestor-projetos-fab/backend/storage/cipavd-reports',
];

export function getCipavdReportsDir() {
  const persistentCipavdReportsDir =
    process.env.CIPAVD_REPORTS_DIR?.trim() || defaultCipavdReportsDir;
  if (!fs.existsSync(persistentCipavdReportsDir)) {
    fs.mkdirSync(persistentCipavdReportsDir, { recursive: true });
  }
  return persistentCipavdReportsDir;
}

export function resolveExistingCipavdReportPath(fileName: string) {
  const safeName = path.basename(String(fileName ?? '').trim());
  if (!safeName) return '';
  const candidates = [
    path.join(getCipavdReportsDir(), safeName),
    ...legacyCipavdReportsDirs.map((dir) => path.join(dir, safeName)),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}
