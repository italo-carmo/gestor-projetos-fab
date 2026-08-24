export type ComplaintProcessOpenedValue = "" | "SIM" | "NAO";

export function resolveComplaintProcessOpenedValue(input: {
  processOpened?: boolean | null;
  procedureType?: string | null;
}): ComplaintProcessOpenedValue {
  if (input.processOpened === true) return "SIM";
  if (input.processOpened === false) return "NAO";

  const procedureType = String(input.procedureType ?? "").trim();
  return procedureType && procedureType !== "NOT_DEFINED" ? "SIM" : "";
}
