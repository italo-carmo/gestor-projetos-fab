import { CPCA_ARCHIVE_SITUATIONS } from "./cpcaCaseConsistency";

function cleanOptionalText(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

export function isComplaintArchiveReasonRequired(input: {
  status?: string | null;
  procedureCurrentSituation?: string | null;
}) {
  return (
    input.status === "ARCHIVED" ||
    CPCA_ARCHIVE_SITUATIONS.has(
      String(input.procedureCurrentSituation ?? "")
        .trim()
        .toUpperCase(),
    )
  );
}

export function getComplaintArchiveReasonMeta(input: {
  status?: string | null;
  procedureCurrentSituation?: string | null;
  archiveReason?: string | null;
}) {
  const archiveReason = cleanOptionalText(input.archiveReason);
  const isArchived =
    isComplaintArchiveReasonRequired(input) ||
    (input.status === "CONCLUDED" && Boolean(archiveReason));

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
