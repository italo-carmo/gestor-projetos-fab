import { HttpException } from '@nestjs/common';
import { getErrorCode } from './error-codes';

export function throwError(code: string, details?: Record<string, unknown>): never {
  const entry = getErrorCode(code);
  const payload = {
    message: entry.message,
    code,
    details: details ?? entry.details ?? undefined,
  };
  throw new HttpException(payload, entry.httpStatus);
}
