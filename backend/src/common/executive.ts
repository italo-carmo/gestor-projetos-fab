const PII_KEYS = new Set([
  'name',
  'email',
  'phone',
  'contact',
  'contato',
  'commanderName',
]);

export function sanitizeForExecutive<T>(payload: T): T {
  if (payload === null || payload === undefined) return payload;
  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizeForExecutive(item)) as any;
  }
  if (typeof payload === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      if (PII_KEYS.has(key)) continue;
      result[key] = sanitizeForExecutive(value as any);
    }
    return result as T;
  }
  return payload;
}

