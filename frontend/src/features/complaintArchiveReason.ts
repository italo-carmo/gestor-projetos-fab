import { syncCpcaWorkflowStatus } from "./cpcaCaseConsistency";

function cleanOptionalText(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

export function isComplaintArchiveReasonRequired(input: {
  status?: string | null;
  procedureCurrentSituation?: string | null;
}) {
  return (
    syncCpcaWorkflowStatus(
      String(input.status ?? ""),
      String(input.procedureCurrentSituation ?? ""),
    ) === "ARCHIVED"
  );
}

export function getComplaintArchiveReasonMeta(input: {
  status?: string | null;
  procedureCurrentSituation?: string | null;
  archiveReason?: string | null;
}) {
  const isArchived = isComplaintArchiveReasonRequired(input);
  const archiveReason = cleanOptionalText(input.archiveReason);

  if (!isArchived) {
    return {
      isArchived: false,
      isMissingReason: false,
      archiveReason: null,
      badgeLabel: null,
    };
  }

  return {
    isArchived: true,
    isMissingReason: !archiveReason,
    archiveReason,
    badgeLabel: archiveReason
      ? "Comentário de arquivamento"
      : "Arquivamento sem comentário",
  };
}
