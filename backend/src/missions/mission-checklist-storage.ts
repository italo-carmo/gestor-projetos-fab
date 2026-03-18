import * as path from 'node:path';

function resolveRuntimeRoot() {
  if (process.env.NODE_ENV === 'production') {
    return process.cwd();
  }
  return process.cwd();
}

export function getMissionChecklistPhotosDir() {
  return path.resolve(resolveRuntimeRoot(), 'uploads', 'missions', 'checklist');
}

export function getMissionChecklistPhotoCandidates(filename: string) {
  const safeName = path.basename(String(filename ?? ''));
  return [path.resolve(getMissionChecklistPhotosDir(), safeName)];
}
