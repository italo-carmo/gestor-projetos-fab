import type { PrismaService } from '../prisma/prisma.service';

const CONNECTOR_WORDS = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E']);

const COMMON_WORD_FIXES: Record<string, string> = {
  MANAUAS: 'MANAUS',
};

function normalizeWords(value: string) {
  return normalizeFabOm(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => COMMON_WORD_FIXES[word] ?? word);
}

function wordsToPhrase(words: string[]) {
  return words.filter(Boolean).join(' ').trim();
}

function removeConnectorWords(value: string) {
  return wordsToPhrase(
    normalizeWords(value).filter((word) => !CONNECTOR_WORDS.has(word)),
  );
}

function normalizeKey(value: string) {
  return normalizeFabOm(value).replace(/[^A-Z0-9]/g, '');
}

function applyStructuredAliases(value: string, push: (candidate: string) => void) {
  const normalized = normalizeFabOm(value);
  if (!normalized) return;
  const shouldExpandShortPlace = (place: string) =>
    place.length >= 4 || /\s/.test(place);

  const withoutConnectors = removeConnectorWords(normalized);
  if (withoutConnectors && withoutConnectors !== normalized) {
    push(withoutConnectors);
  }

  if (
    normalized === 'HOSPITAL DA FORCA AEREA BRASILEIRA' ||
    withoutConnectors === 'HOSPITAL FORCA AEREA BRASILEIRA'
  ) {
    push('HFAB');
    push('HOSPITAL DA FORCA AEREA BRASILEIRA');
    push('HOSPITAL FORCA AEREA BRASILEIRA');
  }

  if (normalized === 'HFAB') {
    push('HOSPITAL DA FORCA AEREA BRASILEIRA');
    push('HOSPITAL FORCA AEREA BRASILEIRA');
  }

  const baseMatch = normalized.match(/^BASE AEREA(?: DE)? (.+)$/);
  if (baseMatch) {
    const place = baseMatch[1].trim();
    if (place) {
      push(`BASE AEREA ${place}`);
      push(`BA ${place}`);
    }
  }

  const baseShortMatch = normalized.match(/^BA (.+)$/);
  if (baseShortMatch) {
    const place = baseShortMatch[1].trim();
    if (place && shouldExpandShortPlace(place)) {
      push(`BASE AEREA DE ${place}`);
      push(`BASE AEREA ${place}`);
    }
  }

  const hospitalMatch = normalized.match(/^HOSPITAL DE AERONAUTICA(?: DE)? (.+)$/);
  if (hospitalMatch) {
    const place = hospitalMatch[1].trim();
    if (place) {
      push(`HOSPITAL DE AERONAUTICA ${place}`);
      push(`HOSPITAL AERONAUTICA ${place}`);
      push(`HA ${place}`);
    }
  }

  const hospitalShortMatch = normalized.match(/^HA (.+)$/);
  if (hospitalShortMatch) {
    const place = hospitalShortMatch[1].trim();
    if (place && shouldExpandShortPlace(place)) {
      push(`HOSPITAL DE AERONAUTICA DE ${place}`);
      push(`HOSPITAL DE AERONAUTICA ${place}`);
      push(`HOSPITAL AERONAUTICA ${place}`);
    }
  }

  const gapExpandedMatch = normalized.match(/^GRUPAMENTO DE APOIO(?: DE)? (.+)$/);
  if (gapExpandedMatch) {
    const place = gapExpandedMatch[1].trim();
    if (place) {
      push(`GRUPAMENTO DE APOIO ${place}`);
      push(`GAP ${place}`);
    }
  }

  const gapShortMatch = normalized.match(/^GAP (.+)$/);
  if (gapShortMatch) {
    const place = gapShortMatch[1].trim();
    if (place && shouldExpandShortPlace(place)) {
      push(`GRUPAMENTO DE APOIO DE ${place}`);
      push(`GRUPAMENTO DE APOIO ${place}`);
    }
  }

  const comarMatch =
    normalized.match(/^COMAR ([IVXLCDM]+)$/) ??
    normalized.match(/^([IVXLCDM]+) COMAR$/);
  const numeral = comarMatch?.[1];
  if (numeral) {
    push(`COMAR ${numeral}`);
    push(`${numeral} COMAR`);
  }
}

function buildFabOmVariantSet(values: Array<string | null | undefined>) {
  const candidates = new Set<string>();
  const queue: string[] = [];

  const push = (value: string | null | undefined) => {
    const normalized = normalizeFabOm(value);
    if (!normalized || normalized.length <= 1 || candidates.has(normalized)) {
      return;
    }
    candidates.add(normalized);
    queue.push(normalized);
  };

  for (const value of values) push(value);

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    const correctedPhrase = wordsToPhrase(normalizeWords(current));
    if (correctedPhrase && correctedPhrase !== current) {
      push(correctedPhrase);
    }
    for (const token of current.split(/[\/|;,]+/)) push(token);
    if (current.includes('-')) {
      const parts = current
        .split('-')
        .map((part) => part.trim())
        .filter(Boolean);
      for (const part of parts) push(part);
    }
    applyStructuredAliases(current, push);
  }

  return candidates;
}

function scoreKeys(rowKeys: string[], candidateKey: string) {
  let score = -1;
  for (const rowKey of rowKeys) {
    if (!rowKey) continue;
    if (rowKey === candidateKey) {
      score = Math.max(score, 2000 + rowKey.length);
    }
    if (rowKey.length >= 4 && candidateKey.includes(rowKey)) {
      score = Math.max(score, 1500 + rowKey.length);
    }
    if (candidateKey.length >= 4 && rowKey.includes(candidateKey)) {
      score = Math.max(score, 1450 + candidateKey.length);
    }
    if (
      rowKey.length >= 5 &&
      candidateKey.length >= 5 &&
      (rowKey.endsWith(candidateKey) || candidateKey.endsWith(rowKey))
    ) {
      score = Math.max(score, 1250 + Math.min(rowKey.length, candidateKey.length));
    }
  }
  return score;
}

export function normalizeFabOm(value: string | null | undefined) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

export function buildFabOmCandidateSet(fabom: string | null | undefined) {
  return buildFabOmVariantSet([fabom]);
}

export function buildFabOmRowAliasSet(
  code: string | null | undefined,
  name: string | null | undefined,
) {
  return buildFabOmVariantSet([code, name]);
}

export async function resolveBestOmByFabOm(
  prisma: PrismaService,
  fabom: string | null | undefined,
) {
  const candidateKeys = Array.from(buildFabOmCandidateSet(fabom))
    .map((candidate) => normalizeKey(candidate))
    .filter(Boolean);
  if (candidateKeys.length === 0) return null;

  const omRows = await prisma.om.findMany({
    select: { id: true, code: true, name: true, hasCpca: true, uf: true },
  });

  let best:
    | { id: string; code: string; name: string; hasCpca: boolean; uf: string | null }
    | null = null;
  let bestScore = -1;

  for (const row of omRows) {
    const rowKeys = Array.from(buildFabOmRowAliasSet(row.code, row.name))
      .map((candidate) => normalizeKey(candidate))
      .filter(Boolean);
    if (rowKeys.length === 0) continue;

    for (const candidateKey of candidateKeys) {
      const score = scoreKeys(rowKeys, candidateKey);
      if (score > bestScore) {
        best = row;
        bestScore = score;
        continue;
      }
      if (score === bestScore && best) {
        const bestCodeLen = normalizeKey(best.code).length;
        if (normalizeKey(row.code).length > bestCodeLen) {
          best = row;
        }
      }
    }
  }

  return bestScore >= 0 ? best : null;
}
