import { AxiosError } from 'axios';

export type ApiErrorPayload = { message?: string; code?: string; details?: any };

export function parseApiError(error: unknown): ApiErrorPayload {
  const err = error as AxiosError<ApiErrorPayload>;
  if (err?.response?.data?.message) {
    return err.response.data;
  }
  // Sem resposta = falha de rede / backend indisponível
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
