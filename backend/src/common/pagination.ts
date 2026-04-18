export function parsePagination(pageRaw?: string, pageSizeRaw?: string) {
  const normalizedPageSize = String(pageSizeRaw ?? '')
    .trim()
    .toLowerCase();
  if (normalizedPageSize === 'all') {
    return { page: 1, pageSize: -1, skip: 0, take: undefined };
  }
  const page = Math.max(1, Number(pageRaw ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(pageSizeRaw ?? 20) || 20));
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip, take: pageSize };
}
