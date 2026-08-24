import { describe, expect, it } from "vitest";
import {
  buildCpcaAiScopeSummary,
  CPCA_AI_QUICK_PROMPTS,
  getCpcaAiReportFileName,
} from "./cpcaAi";

describe("cpcaAi helpers", () => {
  it("resume o escopo configurado da IA CPCA", () => {
    const summary = buildCpcaAiScopeSummary({
      sourceIds: ["complaints_cpca", "tasks"],
      featureIds: [
        "structured_complaints",
        "cpca_case_inconsistencies",
        "traceability_links",
      ],
      knowledgeBaseIds: ["kb-cpca", "kb-ica"],
      knowledgeBases: [
        {
          id: "kb-cpca",
          key: "cpca",
          name: "Base CPCA",
          theme: "CPCA",
          isActive: true,
          sortOrder: 1,
          createdAt: "2026-04-21T00:00:00.000Z",
          updatedAt: "2026-04-21T00:00:00.000Z",
        },
        {
          id: "kb-ica",
          key: "ica-3013",
          name: "ICA 30-13",
          theme: "CPCA",
          isActive: true,
          sortOrder: 2,
          createdAt: "2026-04-21T00:00:00.000Z",
          updatedAt: "2026-04-21T00:00:00.000Z",
        },
      ],
    });

    expect(summary.sourceLabels).toEqual(["Acolhimentos CPCA", "Tarefas"]);
    expect(summary.featureLabels).toContain("Inconsistências CPCA");
    expect(summary.knowledgeBaseLabels).toEqual(["Base CPCA", "ICA 30-13"]);
    expect(summary.counts).toEqual({
      sources: 2,
      features: 3,
      knowledgeBases: 2,
    });
  });

  it("gera nome de arquivo de relatório e mantém prompts rápidos", () => {
    expect(CPCA_AI_QUICK_PROMPTS).toHaveLength(4);
    expect(getCpcaAiReportFileName("2026-04-21T12:00:00.000Z")).toBe(
      "ia-cpca-2026-04-21.pdf",
    );
  });
});
