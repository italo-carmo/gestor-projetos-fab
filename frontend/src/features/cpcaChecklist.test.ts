import { describe, expect, it } from "vitest";
import {
  areCpcaChecklistDraftsEqual,
  buildCpcaChecklistDraft,
  formatCpcaChecklistOmLabel,
  formatCpcaChecklistDate,
  getCpcaChecklistFieldConfig,
  getCpcaChecklistReadOnlyStatusLabel,
  getCpcaChecklistStatusTone,
  isCpcaChecklistBinaryQuestionItem,
  isCpcaChecklistHistoryItem,
  normalizeCpcaChecklistUrl,
  normalizeCpcaChecklistOmCode,
} from "./cpcaChecklist";

describe("cpcaChecklist helpers", () => {
  it("builds a full ordered draft even when the API returns a partial checklist", () => {
    const draft = buildCpcaChecklistDraft([
      {
        itemKey: "PALESTRA",
        label: "Palestra",
        shortLabel: "Palestra",
        description: "Descricao",
        requiresSpeakerName: true,
        isCompleted: true,
        completedAt: "2026-04-21T12:00:00.000Z",
        details: "Tema da palestra",
        speakerName: "Maj Silva",
        supportsHistory: true,
        historyCount: 1,
        historyEntries: [
          {
            id: "entry-1",
            completedAt: "2026-04-21T12:00:00.000Z",
            details: "Tema da palestra",
            speakerName: "Maj Silva",
          },
        ],
      },
    ]);

    expect(draft).toHaveLength(8);
    expect(draft[0]).toMatchObject({
      itemKey: "EMAIL_DIRETO_RELATOS",
      isCompleted: false,
      completedAt: "",
    });
    expect(draft[1]).toMatchObject({
      itemKey: "LINK_INTRAER_CPCA",
      isCompleted: false,
      completedAt: "",
    });
    expect(draft[2]).toMatchObject({
      itemKey: "PALESTRA",
      supportsHistory: true,
      isCompleted: true,
      completedAt: "2026-04-21",
      details: "Tema da palestra",
      speakerName: "Maj Silva",
      historyEntries: [
        {
          id: "entry-1",
          completedAt: "2026-04-21",
          details: "Tema da palestra",
          speakerName: "Maj Silva",
          createdAt: null,
          updatedAt: null,
        },
      ],
    });
  });

  it("compares drafts by effective payload", () => {
    const left = buildCpcaChecklistDraft(undefined);
    const right = buildCpcaChecklistDraft(undefined);

    expect(areCpcaChecklistDraftsEqual(left, right)).toBe(true);

    right[0].details = "Mudou";
    expect(areCpcaChecklistDraftsEqual(left, right)).toBe(false);
  });

  it("formats checklist dates and exposes the expected status tones", () => {
    expect(formatCpcaChecklistDate("2026-04-21T12:00:00.000Z")).toBe(
      "21/04/2026",
    );
    expect(formatCpcaChecklistDate(null)).toBe("-");
    expect(getCpcaChecklistStatusTone("COMPLETED").color).toBe("success");
    expect(getCpcaChecklistStatusTone("IN_PROGRESS").color).toBe("warning");
    expect(getCpcaChecklistStatusTone("NOT_STARTED").color).toBe("default");
  });

  it("normalizes OM labels without duplicating the sigla", () => {
    expect(normalizeCpcaChecklistOmCode("1/1GCC")).toBe("1/1 GCC");
    expect(formatCpcaChecklistOmLabel("1/1GCC", "1/1GCC")).toBe("1/1 GCC");
    expect(formatCpcaChecklistOmLabel("BACO", "Base Aérea de Canoas")).toBe(
      "BACO - Base Aérea de Canoas",
    );
  });

  it("exposes dedicated labels for binary checklist questions", () => {
    expect(isCpcaChecklistBinaryQuestionItem("EMAIL_DIRETO_RELATOS")).toBe(
      true,
    );
    expect(isCpcaChecklistBinaryQuestionItem("LINK_INTRAER_CPCA")).toBe(true);
    expect(isCpcaChecklistBinaryQuestionItem("PALESTRA")).toBe(false);
    expect(isCpcaChecklistHistoryItem("PALESTRA")).toBe(true);
    expect(isCpcaChecklistHistoryItem("LINK_INTRAER_CPCA")).toBe(false);

    expect(getCpcaChecklistFieldConfig("EMAIL_DIRETO_RELATOS")).toMatchObject({
      statusDoneLabel: "Sim",
      statusPendingLabel: "Não",
      detailsLabel: "E-mail direto da CPCA",
    });
    expect(getCpcaChecklistFieldConfig("LINK_INTRAER_CPCA")).toMatchObject({
      statusDoneLabel: "Sim",
      statusPendingLabel: "Não",
      detailsLabel: "URL da página intraer da CPCA",
    });
    expect(
      getCpcaChecklistReadOnlyStatusLabel("EMAIL_DIRETO_RELATOS", true),
    ).toBe("Sim");
    expect(
      getCpcaChecklistReadOnlyStatusLabel("EMAIL_DIRETO_RELATOS", false),
    ).toBe("Não");
    expect(normalizeCpcaChecklistUrl("intraer.fab.mil.br/cpca")).toBe(
      "https://intraer.fab.mil.br/cpca",
    );
    expect(normalizeCpcaChecklistUrl("http://intraer.fab.mil.br/cpca")).toBe(
      "http://intraer.fab.mil.br/cpca",
    );
  });
});
