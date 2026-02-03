import { AxiosError } from 'axios';

export type ApiErrorPayload = { message?: string; code?: string; details?: any };

export function parseApiError(error: unknown): ApiErrorPayload {
  const err = error as AxiosError<ApiErrorPayload>;
  return err?.response?.data ?? { message: 'Erro inesperado' };
}
