import { describe, expect, it } from "vitest";
import {
  getCpcaCaseInconsistencies,
  syncCpcaWorkflowStatus,
} from "./cpcaCaseConsistency";

describe("cpcaCaseConsistency", () => {
  it("marca possível inconsistência pelos arts. 25 e 26 em assédio moral com ocorrência única", () => {
    const warnings = getCpcaCaseInconsistencies({
      complaintType: "MORAL",
      detailedViolenceType: "ASSEDIO_MORAL",
      incidentFrequency: "UMA_VEZ",
    });

    expect(warnings.map((item) => item.code)).toContain("ICA_25_26");
  });

  it("marca revisão para possível importunação sexual em caso sexual entre pares", () => {
    const warnings = getCpcaCaseInconsistencies({
      complaintType: "SEXUAL",
      detailedViolenceType: "ASSEDIO_SEXUAL",
      hierarchicalFunctionalRelation: "MESMA_GRADUACAO",
    });

    expect(warnings.map((item) => item.code)).toContain(
      "ICA_32_II_IMPORTUNACAO",
    );
  });

  it("marca inconsistência quando há data futura no cadastro", () => {
    const warnings = getCpcaCaseInconsistencies(
      {
        reportedAt: "2026-05-30T12:00:00.000Z",
      },
      new Date("2026-04-21T12:00:00.000Z"),
    );

    expect(warnings.map((item) => item.code)).toContain("DATE_IN_FUTURE");
  });

  it("marca inconsistência cronológica quando o ocorrido fica posterior ao recebimento", () => {
    const warnings = getCpcaCaseInconsistencies(
      {
        reportedAt: "2026-04-20T12:00:00.000Z",
        incidentDate: "2026-04-21T12:00:00.000Z",
      },
      new Date("2026-04-21T12:00:00.000Z"),
    );

    expect(warnings.map((item) => item.code)).toContain(
      "INCIDENT_AFTER_REPORT",
    );
  });

  it("sincroniza o status para arquivado quando a situação do procedimento é arquivado pela justiça", () => {
    expect(
      syncCpcaWorkflowStatus("RECEIVED", "ARQUIVADO_PELA_JUSTICA"),
    ).toBe("ARCHIVED");
    expect(syncCpcaWorkflowStatus("INVESTIGATION", "EM_ANDAMENTO")).toBe(
      "INVESTIGATION",
    );
  });
});
