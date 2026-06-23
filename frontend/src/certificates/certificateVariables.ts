export const RECIPIENT_VARIABLE_KEY = "recipient_full_name";
export const EVENT_NAME_VARIABLE_KEY = "event_name";

export const CERTIFICATE_VARIABLE_DEFINITIONS = [
  {
    key: RECIPIENT_VARIABLE_KEY,
    label: "Nome do participante",
    shortLabel: "Participante",
    sample: "NOME COMPLETO DO PARTICIPANTE",
    helper: "Vem automaticamente do campo Nome completo preenchido no forms.",
  },
  {
    key: EVENT_NAME_VARIABLE_KEY,
    label: "Nome do evento",
    shortLabel: "Evento",
    sample: "NOME DO EVENTO",
    helper:
      "Vem automaticamente do nome do evento cadastrado pelo administrador.",
  },
] as const;

export type CertificateVariableKey =
  (typeof CERTIFICATE_VARIABLE_DEFINITIONS)[number]["key"];

export function getCertificateVariableDefinition(variableKey?: string | null) {
  return (
    CERTIFICATE_VARIABLE_DEFINITIONS.find(
      (definition) => definition.key === variableKey,
    ) ?? CERTIFICATE_VARIABLE_DEFINITIONS[0]
  );
}

export function getCertificateVariableSample(variableKey?: string | null) {
  return getCertificateVariableDefinition(variableKey).sample;
}
