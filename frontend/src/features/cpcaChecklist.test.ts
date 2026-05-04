import { describe, expect, it } from "vitest";
import {
  areCpcaChecklistDraftsEqual,
  buildCpcaChecklistDraft,
  buildCpcaChecklistDraftSummary,
  formatCpcaChecklistOmLabel,
  formatCpcaChecklistDate,
  getCpcaChecklistFieldConfig,
  getCpcaChecklistReadOnlyStatusLabel,
  getCpcaChecklistStatusTone,
  isCpcaChecklistBinaryQuestionItem,
  isCpcaChecklistHistoryItem,
  normalizeCpcaChecklistUrl,
  normalizeCpcaChecklistOmCode,
  prepareCpcaChecklistSave,
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
    expect(formatCpcaChecklistDate("2025-11-18T00:00:00.000Z")).toBe(
      "18/11/2025",
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

  it("prepares save payload with a pending history draft", () => {
    const draft = buildCpcaChecklistDraft(undefined);
    const result = prepareCpcaChecklistSave(draft, {
      PALESTRA: {
        completedAt: "2026-05-04",
        details: "Palestra sobre prevenção.",
        speakerName: "Maj Silva",
      },
    });

    if (!result.ok) throw new Error(result.message);

    const palestra = result.items.find((item) => item.itemKey === "PALESTRA");
    expect(palestra).toMatchObject({
      isCompleted: true,
      completedAt: "2026-05-04",
      details: "Palestra sobre prevenção.",
      speakerName: "Maj Silva",
      historyEntries: [
        {
          id: null,
          completedAt: "2026-05-04",
          details: "Palestra sobre prevenção.",
          speakerName: "Maj Silva",
        },
      ],
    });
  });

  it("prepares binary checklist payload without requiring a manual date", () => {
    const draft = buildCpcaChecklistDraft(undefined);
    draft[0] = {
      ...draft[0],
      isCompleted: true,
      details: "cpca@fab.mil.br",
    };

    const result = prepareCpcaChecklistSave(draft);
    if (!result.ok) throw new Error(result.message);

    expect(result.items[0]).toMatchObject({
      itemKey: "EMAIL_DIRETO_RELATOS",
      isCompleted: true,
      completedAt: null,
      details: "cpca@fab.mil.br",
    });
  });

  it("builds draft progress from current screen state", () => {
    const draft = buildCpcaChecklistDraft(undefined);
    draft[0] = {
      ...draft[0],
      isCompleted: true,
      details: "cpca@fab.mil.br",
    };

    expect(buildCpcaChecklistDraftSummary(draft)).toMatchObject({
      completedCount: 1,
      pendingCount: 7,
      completionRate: 13,
      status: "IN_PROGRESS",
    });

    expect(
      buildCpcaChecklistDraftSummary(draft, {
        PALESTRA: {
          completedAt: "2026-05-04",
          details: "Palestra sobre prevenção.",
          speakerName: "Maj Silva",
        },
      }),
    ).toMatchObject({
      completedCount: 2,
      pendingCount: 6,
      completionRate: 25,
      status: "IN_PROGRESS",
    });
  });

  it("blocks checklist save with clear validation before calling the API", () => {
    const missingEmailDraft = buildCpcaChecklistDraft(undefined);
    missingEmailDraft[0] = {
      ...missingEmailDraft[0],
      isCompleted: true,
      details: "",
    };

    expect(prepareCpcaChecklistSave(missingEmailDraft)).toMatchObject({
      ok: false,
      message: "Informe o e-mail direto da CPCA antes de salvar.",
    });

    const invalidEmailDraft = buildCpcaChecklistDraft(undefined);
    invalidEmailDraft[0] = {
      ...invalidEmailDraft[0],
      isCompleted: true,
      details: "email-invalido",
    };

    expect(prepareCpcaChecklistSave(invalidEmailDraft)).toMatchObject({
      ok: false,
      message: "Informe um e-mail direto válido antes de salvar.",
    });

    expect(
      prepareCpcaChecklistSave(buildCpcaChecklistDraft(undefined), {
        MATERIAIS_INFORMATIVOS: {
          completedAt: "2026-05-04",
          details: "",
          speakerName: "",
        },
      }),
    ).toMatchObject({
      ok: false,
      message: "Informe a data e a descrição do registro antes de salvar.",
    });
  });
});
