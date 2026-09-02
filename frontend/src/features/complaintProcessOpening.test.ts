import { describe, expect, it } from "vitest";
import {
  isValidOpenedComplaintProcedure,
  resolveComplaintProcedureTypeForForm,
  resolveComplaintProcessOpenedValue,
} from "./complaintProcessOpening";

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

describe("procedure type when a process was opened", () => {
  it("rejects undefined and no-procedure options", () => {
    expect(isValidOpenedComplaintProcedure("NOT_DEFINED")).toBe(false);
    expect(isValidOpenedComplaintProcedure("NAO_HOUVE")).toBe(false);
    expect(isValidOpenedComplaintProcedure("")).toBe(false);
    expect(isValidOpenedComplaintProcedure("SINDICANCIA")).toBe(true);
  });

  it("loads an invalid saved procedure as blank so it must be adjusted", () => {
    expect(
      resolveComplaintProcedureTypeForForm({
        processOpened: "SIM",
        procedureType: "NOT_DEFINED",
      }),
    ).toBe("");
    expect(
      resolveComplaintProcedureTypeForForm({
        processOpened: "SIM",
        procedureType: "NAO_HOUVE",
      }),
    ).toBe("");
    expect(
      resolveComplaintProcedureTypeForForm({
        processOpened: "SIM",
        procedureType: "IPM",
      }),
    ).toBe("IPM");
  });
});
