export type ComplaintVictimForm = {
  id: string;
  victimRank: string;
  victimGender: string;
  victimAgeRange: string;
  incidentFrequency: string;
  hierarchicalFunctionalRelation: string;
  occurrenceForms: string[];
  isNotifier: boolean;
};

export function createComplaintVictim(isNotifier = false): ComplaintVictimForm {
  return {
    id: crypto.randomUUID(),
    victimRank: "",
    victimGender: "NAO_INFORMADO",
    victimAgeRange: "",
    incidentFrequency: "",
    hierarchicalFunctionalRelation: "",
    occurrenceForms: [],
    isNotifier,
  };
}

export function readComplaintVictims(item: any): ComplaintVictimForm[] {
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
  return rows.map((row: any) => ({
    id: String(row.id ?? "").trim() || crypto.randomUUID(),
    victimRank: String(row.victimRank ?? ""),
    victimGender: String(row.victimGender ?? "NAO_INFORMADO"),
    victimAgeRange: String(row.victimAgeRange ?? ""),
    incidentFrequency: String(row.incidentFrequency ?? ""),
    hierarchicalFunctionalRelation: String(
      row.hierarchicalFunctionalRelation ?? "",
    ),
    occurrenceForms:
      Array.isArray(row.occurrenceForms) && row.occurrenceForms.length
        ? row.occurrenceForms.map(String)
        : row.occurrenceForm
          ? [String(row.occurrenceForm)]
          : [],
    isNotifier: Boolean(row.isNotifier),
  }));
}

export function getNotifyingVictim(victims: ComplaintVictimForm[]) {
  return victims.find((victim) => victim.isNotifier) ?? victims[0];
}

export function removeComplaintVictim(
  victims: ComplaintVictimForm[],
  id: string,
) {
  if (victims.length <= 1) return victims;
  const remaining = victims.filter((victim) => victim.id !== id);
  return remaining.some((victim) => victim.isNotifier)
    ? remaining
    : remaining.map((victim, index) => ({
        ...victim,
        isNotifier: index === 0,
      }));
}
