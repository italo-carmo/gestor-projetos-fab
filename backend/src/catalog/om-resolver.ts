import type { PrismaService } from '../prisma/prisma.service';

export function normalizeFabOm(value: string | null | undefined) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function normalizeKey(value: string) {
  return normalizeFabOm(value).replace(/[^A-Z0-9]/g, '');
}

export async function resolveBestOmByFabOm(
  prisma: PrismaService,
  fabom: string | null | undefined,
) {
  const normalizedFabom = normalizeFabOm(fabom);
  if (!normalizedFabom) return null;

  const candidates = new Set<string>([normalizedFabom]);
  const addCandidate = (value: string | null | undefined) => {
    const trimmed = String(value ?? '').trim();
    if (!trimmed || trimmed.length <= 2) return;
    candidates.add(trimmed);
  };

  for (const token of normalizedFabom.split(/[\/|;,]+/)) {
    addCandidate(token);
  }

  if (normalizedFabom.includes('-')) {
    const parts = normalizedFabom
      .split('-')
      .map((part) => part.trim())
      .filter(Boolean);
    for (const part of parts) addCandidate(part);
  }

  const candidateKeys = Array.from(candidates)
    .map((candidate) => normalizeKey(candidate))
    .filter(Boolean);
  if (candidateKeys.length === 0) return null;

  const omRows = await prisma.om.findMany({
    select: { id: true, code: true, name: true, hasCpca: true, uf: true },
  });

  const computeScore = (rowCode: string, rowName: string, candidateKey: string) => {
    let score = -1;
    if (rowCode && rowCode === candidateKey) {
      score = Math.max(score, 1400 + rowCode.length);
    }
    if (rowCode && rowCode.length >= 3 && candidateKey.includes(rowCode)) {
      score = Math.max(score, 1300 + rowCode.length);
    }
    if (rowCode && candidateKey.length >= 3 && rowCode.includes(candidateKey)) {
      score = Math.max(score, 1250 + candidateKey.length);
    }
    if (rowName && rowName === candidateKey) {
      score = Math.max(score, 1000 + rowName.length);
    }
    if (rowName && rowName.length >= 5 && candidateKey.includes(rowName)) {
      score = Math.max(score, 950 + rowName.length);
    }
    if (
      rowCode &&
      candidateKey &&
      rowCode.length >= 4 &&
      candidateKey.length >= 4 &&
      (rowCode.endsWith(candidateKey) || candidateKey.endsWith(rowCode))
    ) {
      score = Math.max(score, 900 + Math.min(rowCode.length, candidateKey.length));
    }
    return score;
  };

  let best:
    | { id: string; code: string; name: string; hasCpca: boolean; uf: string | null }
    | null = null;
  let bestScore = -1;

  for (const row of omRows) {
    const rowCodeKey = normalizeKey(row.code);
    const rowNameKey = normalizeKey(row.name);
    if (!rowCodeKey && !rowNameKey) continue;

    for (const candidateKey of candidateKeys) {
      const score = computeScore(rowCodeKey, rowNameKey, candidateKey);
      if (score > bestScore) {
        best = row;
        bestScore = score;
        continue;
      }
      if (score === bestScore && best) {
        const bestCodeLen = normalizeKey(best.code).length;
        if (rowCodeKey.length > bestCodeLen) {
          best = row;
        }
      }
    }
  }

  return bestScore >= 0 ? best : null;
}
