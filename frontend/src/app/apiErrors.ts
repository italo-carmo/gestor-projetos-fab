import { AxiosError } from 'axios';

export type ApiErrorPayload = { message?: string; code?: string; details?: any };

const REASON_MESSAGES: Record<string, string> = {
  CONFIDENTIALITY_TERM_REQUIRED_FOR_SEXUAL:
    'Para assédio sexual, o Termo de Sigilo deve ser marcado na etapa 2 (Acolhimento e proteção) antes de salvar.',
  PRELIMINARY_REPORT_DATE_REQUIRES_FLAG:
    'Informe que o relatório preliminar foi gerado antes de definir a data.',
  SEPARATION_APPLIED_REQUIRES_EVALUATION:
    'Marque que a separação foi avaliada antes de aplicá-la.',
  CONTRACTOR_REFERRAL_REQUIRES_OUTSOURCED_FLAG:
    'Marque que o acusado é terceirizado antes de informar a data de encaminhamento.',
  OUTCOME_SUMMARY_REQUIRED_FOR_CLOSURE:
    'Preencha o resumo do desfecho para concluir/arquivar o caso.',
  DEFENSE_CONFIRMATION_REQUIRED_FOR_CLOSURE:
    'Confirme que o direito de defesa do acusado foi assegurado antes de concluir/arquivar.',
  INVALID_STATUS_TRANSITION:
    'Transição de status inválida.',
};

export function parseApiError(error: unknown): ApiErrorPayload {
  const err = error as AxiosError<ApiErrorPayload>;
  if (err?.response?.data?.message) {
    const data = err.response.data;
    const reason = data.details?.reason as string | undefined;
    if (reason && REASON_MESSAGES[reason]) {
      return { ...data, message: REASON_MESSAGES[reason] };
    }
    return data;
  }
  if (err?.request && !err?.response) {
    return {
      message: 'Não foi possível conectar ao servidor. Verifique se o backend está rodando (porta 3000).',
    };
  }
  if (err?.message) {
    return { message: err.message };
  }
  return { message: 'Erro inesperado' };
}
