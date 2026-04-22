import { describe, expect, it } from "vitest";
import {
  BUSINESS_INTELLIGENCE_TABS,
  countActiveBusinessIntelligenceFilters,
  DEFAULT_BUSINESS_INTELLIGENCE_TAB,
  getBusinessIntelligenceQueryPath,
  getBusinessIntelligenceTabs,
  resolveBusinessIntelligenceTab,
} from "./businessIntelligence";

describe("businessIntelligence helpers", () => {
  it("defaults to domestic violence and hides restricted tabs when needed", () => {
    expect(DEFAULT_BUSINESS_INTELLIGENCE_TAB).toBe("domestic-violence");
    expect(
      getBusinessIntelligenceTabs(false).map((tab) => tab.key),
    ).not.toContain("recruits");
    expect(getBusinessIntelligenceTabs(true).map((tab) => tab.key)).toContain(
      "recruits",
    );
    expect(BUSINESS_INTELLIGENCE_TABS).toHaveLength(6);
  });

  it("resolves invalid or unauthorized tabs to the default allowed tab", () => {
    expect(resolveBusinessIntelligenceTab(null, false)).toBe(
      "domestic-violence",
    );
    expect(resolveBusinessIntelligenceTab("recruits", false)).toBe(
      "domestic-violence",
    );
    expect(resolveBusinessIntelligenceTab("schools", false)).toBe("schools");
    expect(resolveBusinessIntelligenceTab("recruits", true)).toBe("recruits");
    expect(getBusinessIntelligenceQueryPath("cpca-meeting")).toBe(
      "/dashboard/bi?tab=cpca-meeting",
    );
  });

  it("counts only meaningful active filters", () => {
    expect(
      countActiveBusinessIntelligenceFilters(
        {
          from: "",
          to: "2026-04-22",
          combineMode: "AND",
          q: " busca ",
          columnFilters: {
            om: "",
            status: "ATIVO",
          },
        },
        ["combineMode"],
      ),
    ).toBe(3);
  });
});
