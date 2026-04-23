import { describe, expect, it } from "vitest";
import {
  clampTasksPage,
  DEFAULT_TASKS_PAGE,
  DEFAULT_TASKS_PAGE_SIZE,
  resolveTasksPage,
  resolveTasksPageSize,
  writeTasksPaginationParams,
} from "./tasksPagination";

describe("tasksPagination", () => {
  it("normalizes invalid page values to the first page", () => {
    expect(resolveTasksPage(null)).toBe(DEFAULT_TASKS_PAGE);
    expect(resolveTasksPage("0")).toBe(DEFAULT_TASKS_PAGE);
    expect(resolveTasksPage("-3")).toBe(DEFAULT_TASKS_PAGE);
    expect(resolveTasksPage("4")).toBe(4);
  });

  it("accepts only the supported page sizes", () => {
    expect(resolveTasksPageSize(null)).toBe(DEFAULT_TASKS_PAGE_SIZE);
    expect(resolveTasksPageSize("15")).toBe(DEFAULT_TASKS_PAGE_SIZE);
    expect(resolveTasksPageSize("50")).toBe(50);
    expect(resolveTasksPageSize("100")).toBe(100);
  });

  it("writes compact pagination params for the default values", () => {
    const current = new URLSearchParams("scope=SMIF&q=abc");
    const next = writeTasksPaginationParams(current, 1, 20);

    expect(next.toString()).toBe("scope=SMIF&q=abc");
  });

  it("persists custom page and page size when needed", () => {
    const current = new URLSearchParams("scope=CIPAVD");
    const next = writeTasksPaginationParams(current, 3, 50);

    expect(next.get("scope")).toBe("CIPAVD");
    expect(next.get("page")).toBe("3");
    expect(next.get("pageSize")).toBe("50");
  });

  it("clamps the page to the last available page", () => {
    expect(clampTasksPage(5, 32, 20)).toBe(2);
    expect(clampTasksPage(2, 0, 20)).toBe(1);
    expect(clampTasksPage(1, 95, 50)).toBe(1);
  });
});
