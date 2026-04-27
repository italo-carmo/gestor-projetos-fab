import { describe, expect, it } from "vitest";
import { taskMatchesFilters } from "../api/hooks";

describe("tasks scope filters", () => {
  it("keeps pending SMIF and CIPAVD tasks isolated by scope", () => {
    expect(
      taskMatchesFilters({ id: "task-1", scope: "CIPAVD" }, { scope: "CIPAVD" }),
    ).toBe(true);
    expect(
      taskMatchesFilters({ id: "task-1", scope: "CIPAVD" }, { scope: "SMIF" }),
    ).toBe(false);
    expect(
      taskMatchesFilters({ id: "task-2", scope: "SMIF" }, { scope: "CIPAVD" }),
    ).toBe(false);
  });

  it("treats tasks without explicit scope as SMIF for backward compatibility", () => {
    expect(taskMatchesFilters({ id: "legacy-task" }, { scope: "SMIF" })).toBe(
      true,
    );
    expect(taskMatchesFilters({ id: "legacy-task" }, { scope: "CIPAVD" })).toBe(
      false,
    );
  });
});
