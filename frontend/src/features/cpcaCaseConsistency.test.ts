import { describe, expect, it } from "vitest";
import {
  getCpcaCaseInconsistencies,
  syncCpcaWorkflowStatus,
} from "./cpcaCaseConsistency";

describe("cpcaCaseConsistency", () => {
  it("identifica a vítima relacionada ao alerta sem duplicar os alertas de datas", () => {
    const warnings = getCpcaCaseInconsistencies(
      {
        detailedViolenceType: "ASSEDIO_MORAL",
        reportedAt: "2026-05-01",
        victims: [
          { incidentFrequency: "DUAS_VEZES" },
          { incidentFrequency: "UMA_VEZ" },
        ],
      },
      new Date("2026-04-21T12:00:00Z"),
    );
    expect(warnings.map((item) => item.code)).toEqual([
      "DATE_IN_FUTURE",
      "ICA_25_26",
    ]);
    expect(warnings[1].summary).toMatch(/^Vítima 2:/);
  });
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

  it("sincroniza o status para arquivado quando o resultado arquiva o procedimento", () => {
    expect(syncCpcaWorkflowStatus("RECEIVED", "ARQUIVADO_PELA_JUSTICA")).toBe(
      "CONCLUDED",
    );
    expect(
      syncCpcaWorkflowStatus("INVESTIGATION", "ARQUIVADO_PELA_ADMINISTRACAO"),
    ).toBe("CONCLUDED");
    expect(syncCpcaWorkflowStatus("INVESTIGATION", "EM_ANDAMENTO")).toBe(
      "INVESTIGATION",
    );
  });
});
