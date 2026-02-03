export function sanitizeText(input: string | null | undefined) {
  if (!input) return '';
  return input
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

