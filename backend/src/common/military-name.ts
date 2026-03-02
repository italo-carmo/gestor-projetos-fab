function normalizeWhitespace(value: string) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function stripOmSuffixFromLdapName(
  rawName: string | null | undefined,
  fabom: string | null | undefined,
) {
  const name = normalizeWhitespace(rawName ?? '');
  if (!name) return '';

  const om = normalizeWhitespace(fabom ?? '').toUpperCase();
  if (!om) return name;

  const upperName = name.toUpperCase();
  if (upperName === om) return '';

  if (upperName.endsWith(` (${om})`)) {
    return name.slice(0, name.length - (` (${om})`.length)).trim();
  }
  if (upperName.endsWith(` - ${om}`)) {
    return name.slice(0, name.length - (` - ${om}`.length)).trim();
  }
  if (upperName.endsWith(` / ${om}`)) {
    return name.slice(0, name.length - (` / ${om}`.length)).trim();
  }
  if (upperName.endsWith(` ${om}`)) {
    return name.slice(0, name.length - (` ${om}`.length)).trim();
  }

  return name;
}

