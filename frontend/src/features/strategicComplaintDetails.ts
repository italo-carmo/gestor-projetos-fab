import { isValidOpenedComplaintProcedure } from "./complaintProcessOpening";
import { getComplaintProcedureLabel } from "./complaintProcedureOptions";
import {
  getComplaintReportStatus,
  getComplaintStatusLabel,
} from "./complaintStatus";

export type StrategicComplaintDetailItem = {
  id: string;
  title: string;
  caseNumber: string;
  complaintType: string;
  workflowScope: string;
  status: string;
  omId: string;
  omLabel: string;
  date?: string;
  link?: string;
  processOpened: boolean | null;
  procedureType: string;
  subsequentProcedureOpened: boolean;
  subsequentProcedureType: string | null;
};

export const STRATEGIC_COMPLAINT_STATUS_LABELS: Record<string, string> = {
  INVESTIGATION: "Em apuração",
  CONCLUDED: "Concluído",
};

export type StrategicComplaintFilters = {
  search: string;
  omId: string;
  procedure: string;
  status: string;
  workflowScope: string;
};

export const EMPTY_STRATEGIC_COMPLAINT_FILTERS: StrategicComplaintFilters = {
  search: "",
  omId: "",
  procedure: "",
  status: "",
  workflowScope: "",
};

export function getStrategicComplaintProcedures(
  item: StrategicComplaintDetailItem,
): string[] {
  if (
    item.processOpened !== true ||
    !isValidOpenedComplaintProcedure(item.procedureType)
  ) {
    return [];
  }
  const procedures = [item.procedureType];
  if (
    item.subsequentProcedureOpened &&
    isValidOpenedComplaintProcedure(item.subsequentProcedureType)
  ) {
    procedures.push(item.subsequentProcedureType!);
  }
  return procedures;
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function filterStrategicComplaints(
  items: StrategicComplaintDetailItem[],
  filters: StrategicComplaintFilters,
) {
  const search = normalizeSearch(filters.search);
  return items.filter((item) => {
    const procedures = getStrategicComplaintProcedures(item);
    if (filters.omId && item.omId !== filters.omId) return false;
    if (
      filters.status &&
      getComplaintReportStatus(item.status) !==
        getComplaintReportStatus(filters.status)
    )
      return false;
    if (filters.workflowScope && item.workflowScope !== filters.workflowScope)
      return false;
    if (filters.procedure === "WITH_PROCEDURE" && !procedures.length)
      return false;
    if (filters.procedure === "WITHOUT_PROCEDURE" && procedures.length)
      return false;
    if (
      filters.procedure &&
      !["WITH_PROCEDURE", "WITHOUT_PROCEDURE"].includes(filters.procedure) &&
      !procedures.includes(filters.procedure)
    )
      return false;
    return (
      !search ||
      normalizeSearch(
        [
          item.title,
          item.caseNumber,
          item.omLabel,
          item.workflowScope,
          getComplaintStatusLabel(item.status),
          ...procedures.map(getComplaintProcedureLabel),
        ].join(" "),
      ).includes(search)
    );
  });
}

export function summarizeStrategicComplaints(
  items: StrategicComplaintDetailItem[],
) {
  const byProcedure = new Map<string, number>();
  let casesWithProcedure = 0;
  for (const item of items) {
    const procedures = getStrategicComplaintProcedures(item);
    if (procedures.length) casesWithProcedure++;
    for (const procedure of procedures) {
      byProcedure.set(procedure, (byProcedure.get(procedure) ?? 0) + 1);
    }
  }
  return {
    procedureCount: Array.from(byProcedure.values()).reduce(
      (total, count) => total + count,
      0,
    ),
    casesWithProcedure,
    byProcedure: Array.from(byProcedure, ([type, count]) => ({ type, count })),
  };
}
