export type CpcaSelfRegistrationRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export type CpcaSelfRegistrationAttempt = {
  id: string;
  attemptNumber: number;
  groupId?: string | null;
  status: CpcaSelfRegistrationRequestStatus;
  createdAt: string;
  decidedAt?: string | null;
  decisionNotes?: string | null;
  requestedAsSubstitution: boolean;
  bulletinNumber: string;
  locality?: {
    id: string;
    code: string;
    name: string;
  } | null;
  accessGranted?: boolean;
};

export type CpcaSelfRegistrationStatusLookupResult = {
  profile?: {
    uid: string;
    name?: string | null;
    email?: string | null;
    fabom?: string | null;
    numeroOrdem?: string | null;
    postoGraduacao?: string | null;
    warName?: string | null;
  } | null;
  locality?: {
    id: string;
    code: string;
    name: string;
    hasCpca: boolean;
  } | null;
  latestRequest?: CpcaSelfRegistrationAttempt | null;
  history?: CpcaSelfRegistrationAttempt[];
  accessGranted?: boolean;
  canResubmit?: boolean;
  hasPendingRequest?: boolean;
};

export function sortCpcaSelfRegistrationHistory<
  T extends CpcaSelfRegistrationAttempt,
>(items: T[] | null | undefined) {
  return [...(items ?? [])].sort((left, right) => {
    const attemptDiff =
      Number(right.attemptNumber ?? 1) - Number(left.attemptNumber ?? 1);
    if (attemptDiff !== 0) return attemptDiff;
    return (
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  });
}

export function getCpcaSelfRegistrationStatusMeta(
  status: CpcaSelfRegistrationRequestStatus | null | undefined,
  accessGranted?: boolean,
) {
  if (status === "APPROVED") {
    return {
      label: "Homologada",
      chipColor: "success" as const,
      alertSeverity: "success" as const,
      description: accessGranted
        ? "Sua solicitação foi homologada e o acesso já está liberado no sistema."
        : "Sua solicitação foi homologada. Caso o acesso ainda não apareça, atualize a página e tente entrar novamente.",
    };
  }
  if (status === "REJECTED") {
    return {
      label: "Rejeitada",
      chipColor: "error" as const,
      alertSeverity: "error" as const,
      description:
        "Sua solicitação foi rejeitada. Revise o motivo abaixo, ajuste os dados necessários e envie uma nova tentativa.",
    };
  }
  return {
    label: "Em homologação",
    chipColor: "warning" as const,
    alertSeverity: "info" as const,
    description:
      "Sua solicitação está em análise pela gestão nacional. Você será liberado para acesso após a homologação.",
  };
}

export function buildCpcaSelfRegistrationResubmissionSeed(
  result: CpcaSelfRegistrationStatusLookupResult | null | undefined,
  fallbackIdentifier: string,
) {
  const latestRequest = result?.latestRequest;
  return {
    identifier:
      String(fallbackIdentifier ?? "").trim() ||
      String(result?.profile?.email ?? "").trim() ||
      String(result?.profile?.uid ?? "").trim(),
    bulletinNumber: String(latestRequest?.bulletinNumber ?? "").trim(),
    isSubstitution: Boolean(latestRequest?.requestedAsSubstitution),
    resubmissionOfId: String(latestRequest?.id ?? "").trim(),
  };
}

export function formatCpcaSelfRegistrationAttemptLabel(attemptNumber: number) {
  const normalized =
    Number.isFinite(attemptNumber) && attemptNumber > 0 ? attemptNumber : 1;
  return `Tentativa ${normalized}`;
}
