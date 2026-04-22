export const CPCA_JUDICIAL_ARCHIVE_SITUATION = 'ARQUIVADO_PELA_JUSTICA' as const;

export function isJudicialArchiveProcedureSituation(
  value: string | null | undefined,
) {
  return (
    String(value ?? '').trim().toUpperCase() ===
    CPCA_JUDICIAL_ARCHIVE_SITUATION
  );
}

export function syncWorkflowStatusWithProcedureSituation(input: {
  status: string | null | undefined;
  procedureCurrentSituation: string | null | undefined;
}) {
  if (isJudicialArchiveProcedureSituation(input.procedureCurrentSituation)) {
    return 'ARCHIVED';
  }
  return String(input.status ?? '').trim() || 'RECEIVED';
}
