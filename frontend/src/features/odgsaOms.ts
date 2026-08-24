export type OdgsaOmAssignmentStatus = "OWN" | "UNASSIGNED" | "OTHER";

export type OdgsaOmItem = {
  id: string;
  code: string;
  name: string;
  uf?: string | null;
  hasCpca?: boolean;
  assignmentStatus: OdgsaOmAssignmentStatus;
  assignedAt?: string | null;
  assignedOdgsa?: { id: string; code: string; name: string } | null;
};

export type OdgsaOmFilter = {
  query?: string;
  uf?: string;
  status?: "ALL" | OdgsaOmAssignmentStatus;
};

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export function filterOdgsaOms(items: OdgsaOmItem[], filters: OdgsaOmFilter) {
  const query = normalize(filters.query);
  const uf = String(filters.uf ?? "")
    .trim()
    .toUpperCase();
  const status = filters.status ?? "ALL";

  return items.filter((item) => {
    if (status !== "ALL" && item.assignmentStatus !== status) return false;
    if (uf && String(item.uf ?? "").toUpperCase() !== uf) return false;
    if (!query) return true;
    return normalize(
      [item.code, item.name, item.uf].filter(Boolean).join(" "),
    ).includes(query);
  });
}

export function getSelectableOdgsaOmIds(items: OdgsaOmItem[]) {
  return items
    .filter((item) => item.assignmentStatus !== "OTHER")
    .map((item) => item.id);
}

export function getSelectedOdgsaOmIdsForAction(
  items: OdgsaOmItem[],
  selectedIds: Iterable<string>,
  action: "ASSIGN" | "UNASSIGN",
) {
  const selected = new Set(selectedIds);
  const expectedStatus = action === "ASSIGN" ? "UNASSIGNED" : "OWN";
  return items
    .filter(
      (item) =>
        selected.has(item.id) && item.assignmentStatus === expectedStatus,
    )
    .map((item) => item.id);
}
