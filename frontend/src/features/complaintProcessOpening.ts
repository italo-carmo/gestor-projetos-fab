export type ComplaintProcessOpenedValue = "" | "SIM" | "NAO";

const INVALID_OPENED_PROCEDURE_TYPES = new Set(["NOT_DEFINED", "NAO_HOUVE"]);

export function isValidOpenedComplaintProcedure(
  procedureType: string | null | undefined,
) {
  const normalized = String(procedureType ?? "")
    .trim()
    .toUpperCase();
  return Boolean(normalized) && !INVALID_OPENED_PROCEDURE_TYPES.has(normalized);
}

export function resolveComplaintProcedureTypeForForm(input: {
  processOpened: ComplaintProcessOpenedValue;
  procedureType?: string | null;
}) {
  const procedureType = String(input.procedureType ?? "").trim();
  if (
    input.processOpened === "SIM" &&
    !isValidOpenedComplaintProcedure(procedureType)
  ) {
    return "";
  }
  return procedureType || "NOT_DEFINED";
}

export function resolveComplaintProcessOpenedValue(input: {
  processOpened?: boolean | null;
  procedureType?: string | null;
}): ComplaintProcessOpenedValue {
  if (input.processOpened === true) return "SIM";
  if (input.processOpened === false) return "NAO";

  const procedureType = String(input.procedureType ?? "").trim();
  return procedureType && procedureType !== "NOT_DEFINED" ? "SIM" : "";
}
