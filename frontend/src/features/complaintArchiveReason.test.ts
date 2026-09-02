import { describe, expect, it } from "vitest";
import {
  getComplaintArchiveReasonMeta,
  isComplaintArchiveReasonRequired,
} from "./complaintArchiveReason";

describe("complaintArchiveReason", () => {
  it("requires archive reason when status is archived explicitly", () => {
    expect(
      isComplaintArchiveReasonRequired({
        status: "ARCHIVED",
        procedureCurrentSituation: "",
      }),
    ).toBe(true);
  });

  it("requires archive reason when the procedure situation syncs the case to archived", () => {
    expect(
      isComplaintArchiveReasonRequired({
        status: "INVESTIGATION",
        procedureCurrentSituation: "ARQUIVADO_PELA_JUSTICA",
      }),
    ).toBe(true);
    expect(
      isComplaintArchiveReasonRequired({
        status: "INVESTIGATION",
        procedureCurrentSituation: "ARQUIVADO_PELA_ADMINISTRACAO",
      }),
    ).toBe(true);
  });

  it("builds the red badge state for archived complaints with and without comment", () => {
    expect(
      getComplaintArchiveReasonMeta({
        status: "ARCHIVED",
        archiveReason:
          "Denúncia arquivada por insuficiência de elementos mínimos.",
      }),
    ).toEqual({
      isArchived: true,
      isMissingReason: false,
      archiveReason:
        "Denúncia arquivada por insuficiência de elementos mínimos.",
      badgeLabel: "Comentário de arquivamento",
    });

    expect(
      getComplaintArchiveReasonMeta({
        status: "ARCHIVED",
        archiveReason: "   ",
      }),
    ).toEqual({
      isArchived: true,
      isMissingReason: true,
      archiveReason: null,
      badgeLabel: "Arquivamento sem comentário",
    });
  });
});
