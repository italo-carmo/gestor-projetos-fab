export const TASKS_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

export type TasksPageSize = (typeof TASKS_PAGE_SIZE_OPTIONS)[number];

export const DEFAULT_TASKS_PAGE = 1;
export const DEFAULT_TASKS_PAGE_SIZE: TasksPageSize = 20;

export function resolveTasksPage(raw: string | null | undefined) {
  const parsed = Number.parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_TASKS_PAGE;
  }
  return parsed;
}

export function resolveTasksPageSize(
  raw: string | null | undefined,
): TasksPageSize {
  const parsed = Number.parseInt(String(raw ?? "").trim(), 10);
  const matched = TASKS_PAGE_SIZE_OPTIONS.find((option) => option === parsed);
  return matched ?? DEFAULT_TASKS_PAGE_SIZE;
}

export function writeTasksPaginationParams(
  params: URLSearchParams,
  page: number,
  pageSize: number,
) {
  const next = new URLSearchParams(params);
  const normalizedPage = resolveTasksPage(String(page));
  const normalizedPageSize = resolveTasksPageSize(String(pageSize));

  if (normalizedPage <= DEFAULT_TASKS_PAGE) next.delete("page");
  else next.set("page", String(normalizedPage));

  if (normalizedPageSize === DEFAULT_TASKS_PAGE_SIZE) next.delete("pageSize");
  else next.set("pageSize", String(normalizedPageSize));

  return next;
}

export function clampTasksPage(
  page: number,
  totalItems: number,
  pageSize: number,
) {
  const normalizedPageSize = resolveTasksPageSize(String(pageSize));
  const totalPages = Math.max(
    DEFAULT_TASKS_PAGE,
    Math.ceil(Math.max(0, totalItems) / normalizedPageSize),
  );
  return Math.min(Math.max(DEFAULT_TASKS_PAGE, Math.trunc(page)), totalPages);
}
