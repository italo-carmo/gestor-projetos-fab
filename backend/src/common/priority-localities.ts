export const TARGET_LOCALITY_NAME_KEYS = new Set([
  'brasilia',
  'canoas',
  'guaratingueta',
  'lagoa santa',
  'manaus',
  'pirassununga',
  'rio de janeiro',
  'sao paulo',
]);

type TargetLocalityCandidate = {
  id?: string | number | null;
  code?: string | null;
  name?: string | null;
  recruitsFemaleCountCurrent?: number | null;
  updatedAt?: Date | string | null;
};

export function normalizeLocalityName(name: string | null | undefined) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function getTargetLocalityKey(name: string | null | undefined) {
  const normalized = normalizeLocalityName(name);
  if (!normalized) return null;

  for (const key of TARGET_LOCALITY_NAME_KEYS) {
    if (
      normalized === key ||
      normalized.startsWith(`${key} `) ||
      normalized.endsWith(` ${key}`) ||
      normalized.includes(` ${key} `)
    ) {
      return key;
    }
  }

  return null;
}

export function isTargetLocalityName(name: string | null | undefined) {
  return Boolean(getTargetLocalityKey(name));
}

function parseTimestamp(value: Date | string | null | undefined) {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : 0;
  }
  if (typeof value === 'string' && value.trim()) {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }
  return 0;
}

function toRecruitsScore(value: number | null | undefined) {
  if (value === null || value === undefined) return -1;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : -1;
}

function compareCandidates(next: TargetLocalityCandidate, current: TargetLocalityCandidate) {
  const recruitsDiff =
    toRecruitsScore(next.recruitsFemaleCountCurrent) -
    toRecruitsScore(current.recruitsFemaleCountCurrent);
  if (recruitsDiff !== 0) return recruitsDiff;

  const updatedDiff = parseTimestamp(next.updatedAt) - parseTimestamp(current.updatedAt);
  if (updatedDiff !== 0) return updatedDiff;

  return 0;
}

export function groupTargetLocalities<T extends TargetLocalityCandidate>(localities: T[]) {
  const grouped = new Map<string, { key: string; canonical: T; members: T[] }>();

  for (const locality of localities) {
    const key = getTargetLocalityKey(locality?.name);
    if (!key) continue;

    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { key, canonical: locality, members: [locality] });
      continue;
    }

    existing.members.push(locality);
    if (compareCandidates(locality, existing.canonical) > 0) {
      existing.canonical = locality;
    }
  }

  return Array.from(grouped.values());
}

export function selectTargetLocalities<T extends TargetLocalityCandidate>(localities: T[]) {
  return groupTargetLocalities(localities).map((group) => group.canonical);
}

export function createTargetLocalityAliasMap<T extends TargetLocalityCandidate>(
  groups: Array<{ key: string; canonical: T; members: T[] }>,
) {
  const aliasByLocalityId = new Map<string, string>();
  const aliasIdsByCanonicalId = new Map<string, string[]>();

  for (const group of groups) {
    const canonicalId = String(group.canonical.id ?? '');
    if (!canonicalId) continue;
    const aliasIds: string[] = [];

    for (const member of group.members) {
      const aliasId = String(member.id ?? '');
      if (!aliasId) continue;
      aliasIds.push(aliasId);
      aliasByLocalityId.set(aliasId, canonicalId);
    }

    aliasIdsByCanonicalId.set(canonicalId, aliasIds);
  }

  return { aliasByLocalityId, aliasIdsByCanonicalId };
}
