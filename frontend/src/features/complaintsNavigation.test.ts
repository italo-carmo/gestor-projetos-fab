import { describe, expect, it } from "vitest";
import {
  buildComplaintWorkflowParams,
  resolveComplaintWorkflow,
} from "./complaintsNavigation";

describe("complaintsNavigation", () => {
  it("abre CPCA por padrão quando os dois fluxos estão disponíveis", () => {
    expect(
      resolveComplaintWorkflow({
        requestedScope: null,
        canViewCpca: true,
        canViewSmif: true,
      }),
    ).toBe("CPCA");
  });

  it("abre o fluxo solicitado quando o usuário possui acesso", () => {
    expect(
      resolveComplaintWorkflow({
        requestedScope: "SMIF",
        canViewCpca: true,
        canViewSmif: true,
      }),
    ).toBe("SMIF");
  });

  it("direciona para o único fluxo permitido", () => {
    expect(
      resolveComplaintWorkflow({
        requestedScope: "SMIF",
        canViewCpca: true,
        canViewSmif: false,
      }),
    ).toBe("CPCA");
    expect(
      resolveComplaintWorkflow({
        requestedScope: null,
        canViewCpca: false,
        canViewSmif: true,
      }),
    ).toBe("SMIF");
  });

  it("limpa filtros incompatíveis ao trocar de aba", () => {
    const current = new URLSearchParams(
      "q=CPCA-1&localityId=om-1&validationStatus=PENDING&page=4&pageSize=50&globalLocalityId=global-1",
    );
    const smifParams = buildComplaintWorkflowParams(current, "SMIF");

    expect(smifParams.get("scope")).toBe("SMIF");
    expect(smifParams.get("q")).toBeNull();
    expect(smifParams.get("localityId")).toBeNull();
    expect(smifParams.get("validationStatus")).toBeNull();
    expect(smifParams.get("page")).toBeNull();
    expect(smifParams.get("pageSize")).toBe("50");
    expect(smifParams.get("globalLocalityId")).toBe("global-1");

    const cpcaParams = buildComplaintWorkflowParams(smifParams, "CPCA");
    expect(cpcaParams.get("scope")).toBeNull();
  });
});
