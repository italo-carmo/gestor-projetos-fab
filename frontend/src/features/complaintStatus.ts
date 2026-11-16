export const COMPLAINT_STATUS_OPTIONS = [
  { value: "INVESTIGATION", label: "Em apuração" },
  { value: "CONCLUDED", label: "Concluído" },
];

export function getComplaintReportStatus(status?: string | null) {
  return status === "CONCLUDED" || status === "ARCHIVED"
    ? "CONCLUDED"
    : "INVESTIGATION";
}

export function getComplaintStatusLabel(status?: string | null) {
  return getComplaintReportStatus(status) === "CONCLUDED"
    ? "Concluído"
    : "Em apuração";
}
