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
    .trim()
    .toLowerCase();
}

export function isTargetLocalityName(name: string | null | undefined) {
  return TARGET_LOCALITY_NAME_KEYS.has(normalizeLocalityName(name));
}
