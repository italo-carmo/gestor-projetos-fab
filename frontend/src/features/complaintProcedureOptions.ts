import { isValidOpenedComplaintProcedure } from "./complaintProcessOpening";

export const COMPLAINT_PROCEDURE_OPTIONS = [
  { value: "NOT_DEFINED", label: "Não definido" },
  { value: "PATD", label: "PATD" },
  { value: "APF", label: "APF" },
  { value: "SINDICANCIA", label: "Sindicância" },
  { value: "PAD", label: "PAD" },
  { value: "IPM", label: "IPM" },
  { value: "BOLETIM_OCORRENCIA", label: "Boletim de ocorrência" },
  { value: "INQUERITO_CIVIL", label: "Inquérito civil" },
  { value: "NAO_HOUVE", label: "Não houve" },
  {
    value: "INQUERITO_POLICIAL_COMUM",
    label: "Inquérito Policial Comum",
  },
  { value: "NOTICIA_FATO", label: "Notícia de Fato" },
  { value: "CONSELHO_DISCIPLINA", label: "Conselho de Disciplina" },
  { value: "CONSELHO_JUSTIFICACAO", label: "Conselho de Justificação" },
] as const;

export const COMPLAINT_OPENED_PROCEDURE_OPTIONS =
  COMPLAINT_PROCEDURE_OPTIONS.filter((item) =>
    isValidOpenedComplaintProcedure(item.value),
  );

export const COMPLAINT_PROCEDURE_RESULT_OPTIONS = [
  {
    value: "MEDIDA_DISCIPLINAR_APLICADA",
    label: "Medida disciplinar aplicada",
  },
  { value: "OFERECIDA_DENUNCIA", label: "Oferecida a denúncia" },
  { value: "ARQUIVADO_PELA_JUSTICA", label: "Arquivado pela justiça" },
  {
    value: "ARQUIVADO_PELA_ADMINISTRACAO",
    label: "Arquivado pela administração",
  },
  { value: "CONDENADO_PELA_JUSTICA", label: "Condenado pela Justiça" },
  { value: "OUTROS", label: "Outros" },
  { value: "NAO_APLICAVEL", label: "Não aplicável" },
] as const;

export function getComplaintProcedureLabel(value: unknown) {
  const normalized = String(value ?? "").trim();
  return (
    COMPLAINT_PROCEDURE_OPTIONS.find((item) => item.value === normalized)
      ?.label ?? normalized.replaceAll("_", " ")
  );
}

export function getComplaintProcedureResultLabel(value: unknown) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "Resultado não informado";
  return (
    COMPLAINT_PROCEDURE_RESULT_OPTIONS.find((item) => item.value === normalized)
      ?.label ?? normalized.replaceAll("_", " ")
  );
}
