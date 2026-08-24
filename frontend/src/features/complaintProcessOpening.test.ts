import { describe, expect, it } from "vitest";
import { resolveComplaintProcessOpenedValue } from "./complaintProcessOpening";

describe("resolveComplaintProcessOpenedValue", () => {
  it("preserva as respostas explícitas", () => {
    expect(
      resolveComplaintProcessOpenedValue({
        processOpened: true,
        procedureType: "NOT_DEFINED",
      }),
    ).toBe("SIM");
    expect(
      resolveComplaintProcessOpenedValue({
        processOpened: false,
        procedureType: "SINDICANCIA",
      }),
    ).toBe("NAO");
  });

  it("interpreta procedimento legado selecionado como sim", () => {
    expect(
      resolveComplaintProcessOpenedValue({ procedureType: "SINDICANCIA" }),
    ).toBe("SIM");
  });

  it("mantém sem seleção o registro legado sem procedimento", () => {
    expect(
      resolveComplaintProcessOpenedValue({ procedureType: "NOT_DEFINED" }),
    ).toBe("");
    expect(resolveComplaintProcessOpenedValue({})).toBe("");
  });
});
