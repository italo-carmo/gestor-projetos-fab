export type ComplaintWorkflow = "CPCA" | "SMIF";

const COMPLAINT_FILTER_PARAMS = [
  "caseId",
  "q",
  "localityId",
  "status",
  "detailedViolenceType",
  "procedureType",
  "validationStatus",
  "page",
];

export function resolveComplaintWorkflow(args: {
  requestedScope: string | null;
  canViewCpca: boolean;
  canViewSmif: boolean;
}): ComplaintWorkflow {
  const requestedWorkflow: ComplaintWorkflow =
    String(args.requestedScope ?? "").toUpperCase() === "SMIF"
      ? "SMIF"
      : "CPCA";

  if (requestedWorkflow === "CPCA" && args.canViewCpca) return "CPCA";
  if (requestedWorkflow === "SMIF" && args.canViewSmif) return "SMIF";
  if (args.canViewCpca) return "CPCA";
  return "SMIF";
}

export function setComplaintWorkflowParam(
  currentParams: URLSearchParams,
  workflow: ComplaintWorkflow,
): URLSearchParams {
  const next = new URLSearchParams(currentParams);
  if (workflow === "SMIF") next.set("scope", "SMIF");
  else next.delete("scope");
  return next;
}

export function buildComplaintWorkflowParams(
  currentParams: URLSearchParams,
  workflow: ComplaintWorkflow,
): URLSearchParams {
  const next = setComplaintWorkflowParam(currentParams, workflow);
  COMPLAINT_FILTER_PARAMS.forEach((param) => next.delete(param));
  return next;
}
