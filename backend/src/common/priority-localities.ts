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

export function normalizeLocalityName(name: string | null | undefined) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function isTargetLocalityName(name: string | null | undefined) {
  const normalized = normalizeLocalityName(name);
  if (!normalized) return false;

  for (const key of TARGET_LOCALITY_NAME_KEYS) {
    if (
      normalized === key ||
      normalized.startsWith(`${key} `) ||
      normalized.endsWith(` ${key}`) ||
      normalized.includes(` ${key} `)
    ) {
      return true;
    }
  }

  return false;
}
