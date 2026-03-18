import * as path from 'node:path';

/** Diretório persistente para fotos do checklist (fora da árvore do deploy). Em produção, defina MISSION_CHECKLIST_UPLOADS_DIR (ex: /var/lib/cipavd/mission-checklist-uploads). */
export function getMissionChecklistPhotosDir() {
  const envDir = process.env.MISSION_CHECKLIST_UPLOADS_DIR;
  if (envDir && typeof envDir === 'string' && envDir.trim()) {
    return path.resolve(envDir.trim());
  }
  return path.resolve(process.cwd(), 'uploads', 'missions', 'checklist');
}

export function getMissionChecklistPhotoCandidates(filename: string) {
  const safeName = path.basename(String(filename ?? ''));
  return [path.resolve(getMissionChecklistPhotosDir(), safeName)];
}
