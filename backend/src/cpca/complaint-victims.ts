import { randomUUID } from 'node:crypto';
import { throwError } from '../common/http-error';

export type ComplaintVictim = {
  id: string;
  victimRank: string;
  victimGender: string;
  victimAgeRange: string | null;
  incidentFrequency: string | null;
  hierarchicalFunctionalRelation: string | null;
  occurrenceForms: string[];
  isNotifier: boolean;
};

const text = (value: unknown) => String(value ?? '').trim();
const optionalText = (value: unknown) => text(value) || null;

export function readComplaintVictims(item: any): ComplaintVictim[] {
  const rows =
    Array.isArray(item?.victims) && item.victims.length
      ? item.victims
      : [
          {
            ...item,
            id: item?.id ? `victim-${item.id}` : undefined,
            isNotifier: item?.victimIsNotifier !== false,
          },
        ];
  return rows.map((row: any, index: number) => ({
    id: text(row.id) || `victim-${item?.id ?? 'legacy'}-${index}`,
    victimRank: text(row.victimRank),
    victimGender: text(row.victimGender) || 'NAO_INFORMADO',
    victimAgeRange: optionalText(row.victimAgeRange),
    incidentFrequency: optionalText(row.incidentFrequency),
    hierarchicalFunctionalRelation: optionalText(
      row.hierarchicalFunctionalRelation,
    ),
    occurrenceForms: Array.from(
      new Set(
        (Array.isArray(row.occurrenceForms) && row.occurrenceForms.length
          ? row.occurrenceForms
          : row.occurrenceForm
            ? [row.occurrenceForm]
            : []
        )
          .map(text)
          .filter(Boolean),
      ),
    ) as string[],
    isNotifier: Boolean(row.isNotifier),
  }));
}

export function resolveComplaintVictims(
  payload: any,
  current?: any,
): ComplaintVictim[] {
  const legacyFields = [
    'victimRank',
    'victimGender',
    'victimAgeRange',
    'incidentFrequency',
    'hierarchicalFunctionalRelation',
    'occurrenceForms',
  ] as const;
  let rows: any[];
  if (payload.victims !== undefined) {
    if (!Array.isArray(payload.victims) || !payload.victims.length) {
      throwError('VALIDATION_ERROR', {
        field: 'victims',
        reason: 'AT_LEAST_ONE_VICTIM_REQUIRED',
      });
    }
    rows = payload.victims.map((row: any, index: number) => {
      if (!row || typeof row !== 'object' || Array.isArray(row))
        throwError('VALIDATION_ERROR', {
          field: `victims.${index}`,
          reason: 'INVALID_VICTIM_RECORD',
        });
      return { ...row, id: text(row.id) || randomUUID() };
    });
  } else {
    rows = readComplaintVictims(current ?? payload);
    const first = { ...rows[0] };
    if (!current) first.id = randomUUID();
    for (const field of legacyFields) {
      if (payload[field] !== undefined) first[field] = payload[field];
    }
    if (
      payload.occurrenceForms === undefined &&
      payload.occurrenceForm !== undefined
    ) {
      first.occurrenceForms = payload.occurrenceForm
        ? [payload.occurrenceForm]
        : [];
    }
    rows = [first, ...rows.slice(1)];
  }
  const victims = readComplaintVictims({ victims: rows });
  const ids = new Set<string>();
  for (const [index, victim] of victims.entries()) {
    if (!victim.victimRank)
      throwError('VALIDATION_ERROR', {
        field: `victims.${index}.victimRank`,
        reason: 'VICTIM_RANK_REQUIRED',
        victimIndex: index,
      });
    if (ids.has(victim.id))
      throwError('VALIDATION_ERROR', {
        field: 'victims',
        reason: 'DUPLICATE_VICTIM_ID',
      });
    ids.add(victim.id);
  }
  const isVictimNotifier =
    payload.victimIsNotifier ?? current?.victimIsNotifier ?? true;
  if (isVictimNotifier && victims.filter((row) => row.isNotifier).length > 1) {
    throwError('VALIDATION_ERROR', {
      field: 'victims',
      reason: 'ONLY_ONE_NOTIFIER_VICTIM',
    });
  }
  const notifierIndex = Math.max(
    0,
    victims.findIndex((row) => row.isNotifier),
  );
  return victims.map((row, index) => ({
    ...row,
    isNotifier: Boolean(isVictimNotifier && index === notifierIndex),
  }));
}
