import { describe, expect, it } from "vitest";
import {
  buildCpcaSelfRegistrationResubmissionSeed,
  formatCpcaSelfRegistrationAttemptLabel,
  getCpcaSelfRegistrationStatusMeta,
  hasCpcaSelfRegistrationApprovedAccess,
  sortCpcaSelfRegistrationHistory,
} from "./cpcaSelfRegistrationStatus";

describe("cpcaSelfRegistrationStatus helpers", () => {
  it("ordena o histórico da tentativa mais antiga para a mais recente", () => {
    const sorted = sortCpcaSelfRegistrationHistory([
      {
        id: "req-1",
        attemptNumber: 1,
        status: "REJECTED",
        createdAt: "2026-04-21T10:00:00.000Z",
        bulletinNumber: "BOL 095",
        requestedAsSubstitution: false,
      },
      {
        id: "req-2",
        attemptNumber: 2,
        status: "PENDING",
        createdAt: "2026-04-22T10:00:00.000Z",
        bulletinNumber: "BOL 101",
        requestedAsSubstitution: true,
      },
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["req-1", "req-2"]);
  });

  it("gera o resumo correto para homologação aprovada com acesso liberado", () => {
    expect(getCpcaSelfRegistrationStatusMeta("APPROVED", true)).toMatchObject({
      label: "Homologada",
      chipColor: "success",
      alertSeverity: "success",
    });
  });

  it("não exibe acesso liberado quando a última solicitação ainda está em homologação", () => {
    expect(
      hasCpcaSelfRegistrationApprovedAccess({
        latestRequest: {
          id: "req-pending",
          attemptNumber: 2,
          status: "PENDING",
          createdAt: "2026-04-22T10:00:00.000Z",
          bulletinNumber: "BOL 101",
          requestedAsSubstitution: false,
          accessGranted: true,
        },
        accessGranted: true,
      }),
    ).toBe(false);
  });

  it("exibe acesso liberado quando a última solicitação está homologada", () => {
    expect(
      hasCpcaSelfRegistrationApprovedAccess({
        latestRequest: {
          id: "req-approved",
          attemptNumber: 1,
          status: "APPROVED",
          createdAt: "2026-04-22T10:00:00.000Z",
          bulletinNumber: "BOL 101",
          requestedAsSubstitution: false,
          accessGranted: true,
        },
        accessGranted: true,
      }),
    ).toBe(true);
  });

  it("monta os dados de reenvio a partir da tentativa rejeitada mais recente", () => {
    const seed = buildCpcaSelfRegistrationResubmissionSeed(
      {
        profile: {
          uid: "uid-pres-1",
          email: "presidente@fab.mil.br",
        },
        latestRequest: {
          id: "req-2",
          attemptNumber: 2,
          status: "REJECTED",
          createdAt: "2026-04-22T10:00:00.000Z",
          bulletinNumber: "BOL 101",
          requestedAsSubstitution: true,
        },
      },
      "presidente@fab.mil.br",
    );

    expect(seed).toEqual({
      identifier: "presidente@fab.mil.br",
      bulletinNumber: "BOL 101",
      isSubstitution: true,
      resubmissionOfId: "req-2",
    });
  });

  it("formata o rótulo da tentativa de forma consistente", () => {
    expect(formatCpcaSelfRegistrationAttemptLabel(3)).toBe("Tentativa 3");
    expect(formatCpcaSelfRegistrationAttemptLabel(0)).toBe("Tentativa 1");
  });
});
