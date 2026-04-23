import { describe, expect, it } from "vitest";
import {
  buildComplaintSummaryHighlightSegments,
  extractComplaintSummaryPrivacyReview,
  hasComplaintSummaryChanged,
  normalizeComplaintSummaryForComparison,
} from "./complaintSummaryPrivacy";

describe("complaintSummaryPrivacy helpers", () => {
  it("normaliza o resumo para comparar mudanças reais", () => {
    expect(
      normalizeComplaintSummaryForComparison(
        "  O   capitão entrou em   contato.  ",
      ),
    ).toBe("O capitão entrou em contato.");
  });

  it("ignora diferenças apenas de espaços na comparação", () => {
    expect(
      hasComplaintSummaryChanged(
        "O capitão entrou em contato.",
        "  O capitão   entrou em contato. ",
      ),
    ).toBe(false);

    expect(
      hasComplaintSummaryChanged(
        "O capitão entrou em contato.",
        "O capitão Silva entrou em contato.",
      ),
    ).toBe(true);
  });

  it("extrai a análise estruturada do erro de API quando a IA bloqueia o salvamento", () => {
    const review = extractComplaintSummaryPrivacyReview({
      response: {
        data: {
          message: "validation failed",
          details: {
            reason: "AI_POSSIBLE_MILITARY_NAMES_DETECTED",
            analysis: {
              status: "flagged",
              checkedText: "CAP Silva entrou em contato com a comissão.",
              findings: [
                {
                  excerpt: "CAP Silva",
                  start: 0,
                  end: 9,
                  category: "RANK_PLUS_NAME",
                  confidence: "HIGH",
                  explanation: "posto associado a sobrenome",
                  source: "heuristic",
                },
              ],
              engine: "hybrid",
              model: "openai/gpt-4.1-mini",
              userMessage:
                "A Inteligência Artificial identificou a presença de possíveis nomes no texto.",
            },
          },
        },
      },
    });

    expect(review).toMatchObject({
      status: "flagged",
      checkedText: "CAP Silva entrou em contato com a comissão.",
      engine: "hybrid",
      model: "openai/gpt-4.1-mini",
    });
    expect(review?.findings).toHaveLength(1);
    expect(review?.findings[0]).toMatchObject({
      excerpt: "CAP Silva",
      start: 0,
      end: 9,
    });
  });

  it("segmenta o texto com destaque amarelo para os trechos sinalizados", () => {
    const segments = buildComplaintSummaryHighlightSegments(
      "CAP Silva entrou em contato com a comissão.",
      [
        {
          excerpt: "CAP Silva",
          start: 0,
          end: 9,
          category: "RANK_PLUS_NAME",
          confidence: "HIGH",
          explanation: "posto associado a sobrenome",
          source: "heuristic",
        },
      ],
    );

    expect(segments).toEqual([
      expect.objectContaining({
        highlighted: true,
        text: "CAP Silva",
      }),
      expect.objectContaining({
        highlighted: false,
        text: " entrou em contato com a comissão.",
      }),
    ]);
  });
});
