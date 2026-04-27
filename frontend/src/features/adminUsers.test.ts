import { describe, expect, it } from "vitest";
import {
  canDeleteUserAccessInUi,
  normalizeEmailSettingDraft,
} from "./adminUsers";

describe("adminUsers helpers", () => {
  it("allows only TI users to delete another user access in the UI", () => {
    expect(
      canDeleteUserAccessInUi(
        { id: "ti-1", activeRole: { name: "TI" }, roles: [] },
        "user-2",
        true,
      ),
    ).toBe(true);

    expect(
      canDeleteUserAccessInUi(
        { id: "comgep-1", activeRole: { name: "COMGEP" }, roles: [] },
        "user-2",
        true,
      ),
    ).toBe(false);

    expect(
      canDeleteUserAccessInUi(
        { id: "ti-1", activeRole: { name: "TI" }, roles: [] },
        "ti-1",
        true,
      ),
    ).toBe(false);

    expect(
      canDeleteUserAccessInUi(
        { id: "ti-1", activeRole: { name: "TI" }, roles: [] },
        "user-2",
        false,
      ),
    ).toBe(false);
  });

  it("normalizes email settings drafts before comparing with the baseline", () => {
    expect(normalizeEmailSettingDraft(" TI.CPCA@FAB.MIL.BR ")).toBe(
      "ti.cpca@fab.mil.br",
    );
    expect(normalizeEmailSettingDraft(null)).toBe("");
  });
});
