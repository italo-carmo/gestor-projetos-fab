import { AxiosError } from "axios";

export type ApiErrorPayload = {
  message?: string;
  code?: string;
  details?: Record<string, unknown>;
};

const REASON_MESSAGES: Record<string, string> = {
  CONFIDENTIALITY_TERM_REQUIRED_FOR_SEXUAL:
    "Para assédio sexual, o Termo de Sigilo deve ser marcado na etapa 2 (Acolhimento e proteção) antes de salvar.",
  PRELIMINARY_REPORT_DATE_REQUIRES_FLAG:
    "Informe que o relatório preliminar foi gerado antes de definir a data.",
  SEPARATION_APPLIED_REQUIRES_EVALUATION:
    "Marque que a separação foi avaliada antes de aplicá-la.",
  CONTRACTOR_REFERRAL_REQUIRES_OUTSOURCED_FLAG:
    "Marque que o acusado é terceirizado antes de informar a data de encaminhamento.",
  OUTCOME_SUMMARY_REQUIRED_FOR_CLOSURE:
    "Preencha o resumo do desfecho para concluir/arquivar o caso.",
  DEFENSE_CONFIRMATION_REQUIRED_FOR_CLOSURE:
    "Confirme que o direito de defesa do acusado foi assegurado antes de concluir/arquivar.",
  CPCA_NOT_ENABLED_FOR_LOCALITY:
    "A OM selecionada não está com CPCA habilitado no cadastro de OMs.",
  CPCA_LOCALITY_ALREADY_HAS_PRESIDENT:
    "Já existe presidente CPCA para esta OM. Confirme ciência para prosseguir com a troca.",
  CPCA_PRESIDENT_REQUEST_ALREADY_PENDING:
    "Já existe uma solicitação pendente para este militar nessa OM.",
  CPCA_PRESIDENT_REQUEST_ALREADY_PROCESSED:
    "Esta solicitação já foi processada anteriormente.",
  CPCA_SELF_REGISTRATION_LOCALITY_MISMATCH:
    "Você não pode se cadastrar como presidente da CPCA de uma OM diferente da sua OM no LDAP.",
  CPCA_SELF_REGISTRATION_LDAP_LOCALITY_NOT_FOUND:
    "Não foi possível identificar sua OM no LDAP para validar o cadastro.",
  CPCA_SELF_REGISTRATION_LDAP_LOCALITY_WITHOUT_CPCA:
    "Sua OM no LDAP ainda não está habilitada com CPCA no sistema.",
  CPCA_PRESIDENT_CANNOT_BE_MEMBER:
    "O presidente da comissão não pode ser adicionado como membro.",
  NOTIFIER_RANK_REQUIRED_WHEN_DIFFERENT:
    "Quando noticiante e vítima forem pessoas diferentes, informe o posto/graduação do noticiante.",
  NOTIFIER_GENDER_REQUIRED_WHEN_DIFFERENT:
    "Quando noticiante e vítima forem pessoas diferentes, informe o sexo do noticiante.",
  INVALID_STATUS_TRANSITION: "Transição de status inválida.",
};

export function parseApiError(error: unknown): ApiErrorPayload {
  const err = error as AxiosError<ApiErrorPayload>;
  if (err?.response?.data?.message) {
    const data = err.response.data;
    const reasonRaw = data.details?.reason;
    const reason = typeof reasonRaw === "string" ? reasonRaw : undefined;
    if (reason && REASON_MESSAGES[reason]) {
      return { ...data, message: REASON_MESSAGES[reason] };
    }
    return data;
  }
  if (err?.request && !err?.response) {
    return {
      message:
        "Não foi possível conectar ao servidor. Verifique se o backend está rodando (porta 3000).",
    };
  }
  if (err?.message) {
    return { message: err.message };
  }
  return { message: "Erro inesperado" };
}
