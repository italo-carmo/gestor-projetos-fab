export type OmCpcaCoverageFilter =
  | "ALL"
  | "COVERED"
  | "OWN_CPCA"
  | "MANAGED_BY_OTHER"
  | "UNCOVERED";

type OmCpcaCoverageLike = {
  hasCpca?: boolean | null;
  cpcaManagedByLocality?: { id?: string | null } | null;
};

export type OmCpcaCoverageStatus =
  | "OWN_CPCA"
  | "MANAGED_BY_OTHER"
  | "UNCOVERED";

export function resolveOmCpcaCoverageStatus(
  item: OmCpcaCoverageLike,
): OmCpcaCoverageStatus {
  if (Boolean(item?.hasCpca)) return "OWN_CPCA";
  if (item?.cpcaManagedByLocality?.id) return "MANAGED_BY_OTHER";
  return "UNCOVERED";
}

export function isOmCoveredByCpca(item: OmCpcaCoverageLike) {
  return resolveOmCpcaCoverageStatus(item) !== "UNCOVERED";
}

export function matchesOmCpcaCoverageFilter(
  item: OmCpcaCoverageLike,
  filter: OmCpcaCoverageFilter,
) {
  const status = resolveOmCpcaCoverageStatus(item);
  if (filter === "ALL") return true;
  if (filter === "COVERED") return status !== "UNCOVERED";
  if (filter === "UNCOVERED") return status === "UNCOVERED";
  return status === filter;
}

export function buildOmCpcaCoverageSummary(items: OmCpcaCoverageLike[]) {
  const ownCpca = items.filter(
    (item) => resolveOmCpcaCoverageStatus(item) === "OWN_CPCA",
  ).length;
  const managedByOther = items.filter(
    (item) => resolveOmCpcaCoverageStatus(item) === "MANAGED_BY_OTHER",
  ).length;
  const uncovered = items.filter(
    (item) => resolveOmCpcaCoverageStatus(item) === "UNCOVERED",
  ).length;

  return {
    total: items.length,
    ownCpca,
    managedByOther,
    covered: ownCpca + managedByOther,
    uncovered,
  };
}
