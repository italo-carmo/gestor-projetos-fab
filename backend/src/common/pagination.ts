export function parsePagination(pageRaw?: string, pageSizeRaw?: string) {
  const page = Math.max(1, Number(pageRaw ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(pageSizeRaw ?? 20) || 20));
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip, take: pageSize };
}

