export const CPCA_JUDICIAL_ARCHIVE_SITUATION =
  'ARQUIVADO_PELA_JUSTICA' as const;
export const CPCA_ADMINISTRATIVE_ARCHIVE_SITUATION =
  'ARQUIVADO_PELA_ADMINISTRACAO' as const;

export const CPCA_OPEN_STATUSES = [
  'RECEIVED',
  'PROTECTION_MEASURES',
  'PRELIMINARY_ANALYSIS',
  'PROCEDURE_DEFINED',
  'INVESTIGATION',
];
export const CPCA_CLOSED_STATUSES = ['CONCLUDED', 'ARCHIVED'];
const ARCHIVE_RESULTS = [
  CPCA_JUDICIAL_ARCHIVE_SITUATION,
  CPCA_ADMINISTRATIVE_ARCHIVE_SITUATION,
];

export function getComplaintReportStatus(input: {
  status?: string | null;
  procedureCurrentSituation?: string | null;
}): 'INVESTIGATION' | 'CONCLUDED' {
  return CPCA_CLOSED_STATUSES.includes(String(input.status ?? '')) ||
    isArchiveProcedureSituation(input.procedureCurrentSituation)
    ? 'CONCLUDED'
    : 'INVESTIGATION';
}

export function getComplaintStatusFilter(status: string) {
  if (CPCA_CLOSED_STATUSES.includes(status)) {
    return {
      OR: [
        { status: { in: CPCA_CLOSED_STATUSES } },
        { procedureCurrentSituation: { in: ARCHIVE_RESULTS } },
      ],
    };
  }
  if (status === 'INVESTIGATION') {
    return {
      AND: [
        { status: { in: CPCA_OPEN_STATUSES } },
        {
          OR: [
            { procedureCurrentSituation: null },
            { procedureCurrentSituation: { notIn: ARCHIVE_RESULTS } },
          ],
        },
      ],
    };
  }
  return { status };
}

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
  if (
    input.status === 'ARCHIVED' ||
    isArchiveProcedureSituation(input.procedureCurrentSituation)
  ) {
    return 'CONCLUDED';
  }
  return String(input.status ?? '').trim() || 'RECEIVED';
}
