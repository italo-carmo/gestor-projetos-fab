import { describe, expect, it } from "vitest";
import {
  getComplaintPendingKpiLabel,
  getComplaintPendingStatusTone,
  getComplaintPendencyBadge,
  normalizeComplaintCipavdSummary,
  sortComplaintPendingItems,
} from "./cpcaCipavdThreads";

describe("cpcaCipavdThreads helpers", () => {
  it("normalizes counts and keeps the latest activity reference", () => {
    expect(
      normalizeComplaintCipavdSummary({
        openPendingCount: 2,
        resolvedPendingCount: 1,
        lastActivityAt: "2026-04-22T10:00:00.000Z",
      }),
    ).toMatchObject({
      openPendingCount: 2,
      resolvedPendingCount: 1,
      lastActivityAt: "2026-04-22T10:00:00.000Z",
    });
  });

  it("prioritizes open pendencies and only exposes resolved badges when requested", () => {
    expect(
      getComplaintPendencyBadge({
        openPendingCount: 2,
        resolvedPendingCount: 4,
      }),
    ).toMatchObject({
      tone: "warning",
      label: "Pendências 2",
    });

    expect(
      getComplaintPendencyBadge(
        { openPendingCount: 0, resolvedPendingCount: 1 },
        { showResolved: true },
      ),
    ).toMatchObject({
      tone: "success",
      label: "Pendência resolvida",
    });

    expect(
      getComplaintPendencyBadge(
        { openPendingCount: 0, resolvedPendingCount: 1 },
        { showResolved: false },
      ),
    ).toBeNull();
  });

  it("formats KPI labels and status tones for the complaint pendency flow", () => {
    expect(getComplaintPendingKpiLabel(1)).toBe("pendência ativa");
    expect(getComplaintPendingKpiLabel(4)).toBe("pendências ativas");
    expect(getComplaintPendingStatusTone("OPEN").color).toBe("#B45309");
    expect(getComplaintPendingStatusTone("RESOLVED").color).toBe("#166534");
    expect(getComplaintPendingStatusTone("CLOSED").color).toBe("#475569");
  });

  it("sorts pending items by latest message timestamp", () => {
    const result = sortComplaintPendingItems([
      { id: "old", lastMessageAt: "2026-04-20T10:00:00.000Z" },
      { id: "new", lastMessageAt: "2026-04-22T10:00:00.000Z" },
    ]);

    expect(result.map((item) => item.id)).toEqual(["new", "old"]);
  });
});
