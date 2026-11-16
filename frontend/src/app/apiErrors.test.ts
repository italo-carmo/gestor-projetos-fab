import { describe, expect, it } from "vitest";
import { parseApiError } from "./apiErrors";

it("traduz a data obrigatória do procedimento aberto", () => {
  expect(
    parseApiError({
      response: {
        data: {
          code: "VALIDATION_ERROR",
          message: "Dados inválidos.",
          details: {
            field: "procedureStartDate",
            reason: "PROCESS_OPENED_REQUIRES_START_DATE",
          },
        },
      },
    }).message,
  ).toBe("Informe a data de início do procedimento.");
});

describe("erros da importação do Google Sheets", () => {
  it.each([
    "domestic_violence",
    "recruits",
    "best_practices_cycle",
    "cpca_meeting",
  ])("explica o timeout da pesquisa %s", (prefix) => {
    const result = parseApiError({
      response: {
        data: {
          code: "VALIDATION_ERROR",
          message: "Erro de validação",
          details: { reason: `${prefix}_api_timeout` },
        },
      },
    });
    expect(result.message).toContain("Google Sheets demorou para responder");
    expect(result.message).toContain("respostas existentes foram preservadas");
  });

  it("mantém mensagens de erros não relacionados à integração", () => {
    expect(
      parseApiError({
        response: {
          data: { message: "Sem permissão", code: "RBAC_FORBIDDEN" },
        },
      }),
    ).toEqual({ message: "Sem permissão", code: "RBAC_FORBIDDEN" });
  });
});
