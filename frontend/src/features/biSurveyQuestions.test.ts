import { describe, expect, it } from "vitest";
import {
  BI_CPCA_MEETING_QUESTIONS,
  buildBiSurveyQuestionsFromColumnsMeta,
} from "./biSurveyQuestions";

describe("biSurveyQuestions", () => {
  it("remove metadados e classifica colunas vindas da API", () => {
    const questions = buildBiSurveyQuestionsFromColumnsMeta([
      { key: "carimbo_de_data_hora", label: "Carimbo de data/hora" },
      {
        key: "organizacao_militar",
        label: "Organização Militar",
        type: "CATEGORICAL",
      },
      {
        key: "q02_preparo",
        label: "02 - Você se sente preparado?",
        type: "CATEGORICAL",
        questionNumber: 2,
      },
      {
        key: "comentarios",
        label: "Comentários e sugestões",
        type: "FREE_TEXT",
      },
    ]);

    expect(questions).toEqual([
      {
        id: "organizacao_militar",
        label: "Organização Militar",
        group: "Perfil",
        kind: "Perfil",
      },
      {
        id: "q02_preparo",
        label: "02 - Você se sente preparado?",
        group: "Q2",
        kind: "Alternativa",
      },
      {
        id: "comentarios",
        label: "Comentários e sugestões",
        group: "Texto",
        kind: "Texto livre",
      },
    ]);
  });

  it("usa fallback quando a API ainda não retornou metadados de colunas", () => {
    expect(
      buildBiSurveyQuestionsFromColumnsMeta([], BI_CPCA_MEETING_QUESTIONS),
    ).toBe(BI_CPCA_MEETING_QUESTIONS);
  });
});
