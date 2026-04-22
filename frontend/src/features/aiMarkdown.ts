export function normalizeAiMarkdown(input: string) {
  return String(input ?? "").replace(/<br\s*\/?>/gi, "  \n");
}
