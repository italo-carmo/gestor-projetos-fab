import { describe, expect, it } from "vitest";
import {
  COMPLAINT_STATUS_OPTIONS,
  getComplaintReportStatus,
  getComplaintStatusLabel,
} from "./complaintStatus";

describe("status dos reportes", () => {
  it.each([
    "RECEIVED",
    "PROTECTION_MEASURES",
    "PRELIMINARY_ANALYSIS",
    "PROCEDURE_DEFINED",
    "INVESTIGATION",
  ])("agrupa %s como em apuração", (status) => {
    expect(getComplaintReportStatus(status)).toBe("INVESTIGATION");
    expect(getComplaintStatusLabel(status)).toBe("Em apuração");
  });
  it.each(["CONCLUDED", "ARCHIVED"])("agrupa %s como concluído", (status) => {
    expect(getComplaintReportStatus(status)).toBe("CONCLUDED");
    expect(getComplaintStatusLabel(status)).toBe("Concluído");
  });
  it("oferece apenas em apuração e concluído", () => {
    expect(COMPLAINT_STATUS_OPTIONS).toEqual([
      { value: "INVESTIGATION", label: "Em apuração" },
      { value: "CONCLUDED", label: "Concluído" },
    ]);
  });
});
