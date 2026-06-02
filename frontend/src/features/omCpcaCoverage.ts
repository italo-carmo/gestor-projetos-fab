import { splitMilitaryRankAndName } from "../app/militaryName";

export type OmCpcaCoverageFilter =
  | "ALL"
  | "COVERED"
  | "OWN_CPCA"
  | "MANAGED_BY_OTHER"
  | "UNCOVERED";

export type OmCpcaPresidentFilter =
  | "ALL"
  | "WITH_PRESIDENT"
  | "WITHOUT_PRESIDENT";

type OmCpcaCoverageLike = {
  hasCpca?: boolean | null;
  cpcaManagedByLocality?: { id?: string | null } | null;
  currentPresident?: {
    id?: string | null;
    user?: { name?: string | null } | null;
  } | null;
};

export type OmCpcaCoverageStatus =
  | "OWN_CPCA"
  | "MANAGED_BY_OTHER"
  | "UNCOVERED";

function normalizeWhitespace(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

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

export function hasOmCpcaPresident(item: OmCpcaCoverageLike) {
  return Boolean(
    String(item?.currentPresident?.id ?? "").trim() ||
    String(item?.currentPresident?.user?.name ?? "").trim(),
  );
}

export function matchesOmCpcaPresidentFilter(
  item: OmCpcaCoverageLike,
  filter: OmCpcaPresidentFilter,
) {
  if (filter === "ALL") return true;
  if (filter === "WITH_PRESIDENT") return hasOmCpcaPresident(item);
  return !hasOmCpcaPresident(item);
}

export function formatOmCpcaPresidentBadgeLabel(
  raw: string | null | undefined,
) {
  const { rank, nameWithoutRank, displayName } = splitMilitaryRankAndName(raw);
  const fullName = normalizeWhitespace(displayName);
  if (!fullName) {
    return {
      label: "",
      fullName: "",
    };
  }

  if (!rank) {
    return {
      label: fullName,
      fullName,
    };
  }

  const warName = normalizeWhitespace(nameWithoutRank).split(" ")[0] ?? "";
  const label = normalizeWhitespace([rank, warName].filter(Boolean).join(" "));

  return {
    label: label || fullName,
    fullName,
  };
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
