function normalizeWhitespace(value: string) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

const MILITARY_RANK_PREFIX =
  /^(ALUNO|SD|CB|3S|2S|1S|SO|ASP|CP|CL|MB|TB|2T|1T|CAP|MAJ|TCEL|TEN CEL|CEL|BRIG|BRIGADEIRO|GEN)\b/i;

export function splitMilitaryNameAndOm(raw: string | null | undefined) {
  const name = normalizeWhitespace(raw ?? '');
  if (!name) return { displayName: '', om: null as string | null };

  const upper = name.toUpperCase();
  const separators = [' (', ' - ', ' / '];
  for (const separator of separators) {
    const index = upper.lastIndexOf(separator);
    if (index <= 0) continue;
    const right = upper.slice(index + separator.length).replace(/\)$/, '').trim();
    if (/^[A-Z0-9-]{2,14}$/.test(right)) {
      return {
        displayName: name.slice(0, index).trim(),
        om: right || null,
      };
    }
  }

  const tokens = name.split(' ');
  if (tokens.length >= 3 && MILITARY_RANK_PREFIX.test(tokens[0])) {
    const last = tokens[tokens.length - 1].toUpperCase();
    if (/^[A-Z0-9-]{2,14}$/.test(last)) {
      return {
        displayName: tokens.slice(0, -1).join(' '),
        om: last || null,
      };
    }
  }

  return { displayName: name, om: null };
}

export function toMilitaryDisplayName(raw: string | null | undefined) {
  return splitMilitaryNameAndOm(raw).displayName;
}


