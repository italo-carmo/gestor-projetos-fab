export const CPCA_JUDICIAL_ARCHIVE_SITUATION =
  'ARQUIVADO_PELA_JUSTICA' as const;
export const CPCA_ADMINISTRATIVE_ARCHIVE_SITUATION =
  'ARQUIVADO_PELA_ADMINISTRACAO' as const;

export function isArchiveProcedureSituation(value: string | null | undefined) {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase();
  return (
    normalized === CPCA_JUDICIAL_ARCHIVE_SITUATION ||
    normalized === CPCA_ADMINISTRATIVE_ARCHIVE_SITUATION
  );
}

export function isJudicialArchiveProcedureSituation(
  value: string | null | undefined,
) {
  return (
    String(value ?? '')
      .trim()
      .toUpperCase() === CPCA_JUDICIAL_ARCHIVE_SITUATION
  );
}

export function syncWorkflowStatusWithProcedureSituation(input: {
  status: string | null | undefined;
  procedureCurrentSituation: string | null | undefined;
}) {
  if (isArchiveProcedureSituation(input.procedureCurrentSituation)) {
    return 'ARCHIVED';
  }
  return String(input.status ?? '').trim() || 'RECEIVED';
}
