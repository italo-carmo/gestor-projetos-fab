export type ComplaintCipavdSummary = {
  totalThreads?: number | null;
  noteCount?: number | null;
  totalPendingCount?: number | null;
  openPendingCount?: number | null;
  resolvedPendingCount?: number | null;
  closedPendingCount?: number | null;
  lastActivityAt?: string | null;
};

export function normalizeComplaintCipavdSummary(
  summary: ComplaintCipavdSummary | null | undefined,
) {
  return {
    totalThreads: Math.max(0, Number(summary?.totalThreads ?? 0) || 0),
    noteCount: Math.max(0, Number(summary?.noteCount ?? 0) || 0),
    totalPendingCount: Math.max(
      0,
      Number(summary?.totalPendingCount ?? 0) || 0,
    ),
    openPendingCount: Math.max(0, Number(summary?.openPendingCount ?? 0) || 0),
    resolvedPendingCount: Math.max(
      0,
      Number(summary?.resolvedPendingCount ?? 0) || 0,
    ),
    closedPendingCount: Math.max(
      0,
      Number(summary?.closedPendingCount ?? 0) || 0,
    ),
    lastActivityAt: String(summary?.lastActivityAt ?? "").trim() || null,
  };
}

export function getComplaintPendencyBadge(
  summary: ComplaintCipavdSummary | null | undefined,
  options?: { showResolved?: boolean },
) {
  const normalized = normalizeComplaintCipavdSummary(summary);

  if (normalized.openPendingCount > 0) {
    return {
      tone: "warning" as const,
      label:
        normalized.openPendingCount === 1
          ? "Pendência"
          : `Pendências ${normalized.openPendingCount}`,
    };
  }

  if (options?.showResolved && normalized.resolvedPendingCount > 0) {
    return {
      tone: "success" as const,
      label:
        normalized.resolvedPendingCount === 1
          ? "Pendência resolvida"
          : `Resolvidas ${normalized.resolvedPendingCount}`,
    };
  }

  return null;
}

export function getComplaintPendingKpiLabel(count: number) {
  const safeCount = Math.max(0, Math.floor(Number(count) || 0));
  if (safeCount === 1) return "pendência ativa";
  return "pendências ativas";
}

export function getComplaintPendingStatusTone(
  status: string | null | undefined,
) {
  const normalized = String(status ?? "")
    .trim()
    .toUpperCase();
  if (normalized === "RESOLVED") {
    return {
      color: "#166534",
      background: "rgba(34, 197, 94, 0.12)",
      borderColor: "rgba(34, 197, 94, 0.24)",
    };
  }
  if (normalized === "CLOSED") {
    return {
      color: "#475569",
      background: "rgba(148, 163, 184, 0.14)",
      borderColor: "rgba(148, 163, 184, 0.28)",
    };
  }
  return {
    color: "#B45309",
    background: "rgba(245, 158, 11, 0.14)",
    borderColor: "rgba(245, 158, 11, 0.28)",
  };
}

export function sortComplaintPendingItems<
  T extends { lastMessageAt?: string | null },
>(items: T[]) {
  return [...(items ?? [])].sort((left, right) => {
    const leftTs = new Date(left?.lastMessageAt ?? 0).getTime();
    const rightTs = new Date(right?.lastMessageAt ?? 0).getTime();
    return rightTs - leftTs;
  });
}
