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
      triggerLabel: "O que essa tela responde?",
      badgeLabel: "Guia rápido",
      questionsTitle: "O que esta tela responde",
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

  it("allows overriding the default guide labels for other screens", () => {
    const result = buildStrategicTabGuideUiCopy({
      title: "Chatbot institucional",
      description: "Perguntas abertas com escopo controlado.",
      questions: ["O que posso perguntar aqui?"],
      labels: {
        triggerLabel: "Como esta tela funciona?",
        questionsTitle: "O que você consegue fazer aqui",
      },
    });

    expect(result.triggerLabel).toBe("Como esta tela funciona?");
    expect(result.questionsTitle).toBe("O que você consegue fazer aqui");
    expect(result.badgeLabel).toBe("Guia rápido");
    expect(result.usageTitle).toBe("Como usar esta tela");
  });
});
