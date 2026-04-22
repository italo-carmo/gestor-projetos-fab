import { describe, expect, it } from "vitest";
import { buildStrategicTabGuideUiCopy } from "./strategicTabGuide";

describe("strategicTabGuide", () => {
  it("returns the compact guide labels and preserves the tab content", () => {
    const result = buildStrategicTabGuideUiCopy({
      title: "Visão Geral",
      description: "Resumo executivo.",
      questions: [
        "Qual é o tamanho do problema agora?",
        "O que exige atenção imediata?",
      ],
      usageHint: "Comece por aqui.",
    });

    expect(result).toMatchObject({
      triggerLabel: "Guia da aba",
      badgeLabel: "Guia rápido",
      questionsTitle: "O que esta aba responde",
      usageTitle: "Como usar esta tela",
      title: "Visão Geral",
      description: "Resumo executivo.",
      questions: [
        "Qual é o tamanho do problema agora?",
        "O que exige atenção imediata?",
      ],
      usageHint: "Comece por aqui.",
      hasUsageHint: true,
    });
  });

  it("marks the usage section as absent when the hint is empty", () => {
    const result = buildStrategicTabGuideUiCopy({
      title: "Território",
      description: "Leitura territorial.",
      questions: ["Onde o problema está concentrado?"],
      usageHint: "   ",
    });

    expect(result.hasUsageHint).toBe(false);
    expect(result.usageHint).toBe("");
  });
});
