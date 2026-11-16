import { HttpException } from '@nestjs/common';
import { throwError } from '../common/http-error';

/** Retry only idempotent reads; keep the timeout active while reading JSON. */
export async function fetchBiApiPage<T>(
  url: string | URL,
  reasonPrefix: string,
  timeoutMs: number,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let readingBody = false;
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throwError('VALIDATION_ERROR', {
          reason: `${reasonPrefix}_http_error`,
          status: response.status,
        });
      }
      readingBody = true;
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throwError('VALIDATION_ERROR', {
          reason: `${reasonPrefix}_invalid_payload`,
        });
      }
      const page = payload as {
        ok?: boolean;
        dados?: unknown[];
        has_more?: boolean;
      };
      if (page.ok !== true || !Array.isArray(page.dados)) {
        throwError('VALIDATION_ERROR', {
          reason: `${reasonPrefix}_unsuccessful_payload`,
        });
      }
      if (typeof page.has_more !== 'boolean') {
        throwError('VALIDATION_ERROR', {
          reason: `${reasonPrefix}_invalid_payload`,
        });
      }
      return payload as T;
    } catch (error) {
      const timedOut =
        controller.signal.aborted ||
        (error instanceof Error && error.name === 'AbortError');
      const payload =
        error instanceof HttpException ? error.getResponse() : null;
      const details =
        payload && typeof payload === 'object'
          ? (payload as { details?: { reason?: string; status?: number } })
              .details
          : undefined;
      const transient =
        timedOut ||
        (!(error instanceof HttpException) &&
          (!readingBody || error instanceof TypeError)) ||
        (details?.reason === `${reasonPrefix}_http_error` &&
          ([502, 503, 504].includes(details.status ?? 0) ||
            // Apps Script can intermittently return 404 for a valid deployment.
            // Retry the original URL once to obtain a fresh redirect.
            (details.status === 404 &&
              new URL(url).hostname === 'script.google.com')));
      if (transient && attempt === 0) continue;
      if (error instanceof HttpException) throw error;
      throwError('VALIDATION_ERROR', {
        reason: `${reasonPrefix}_${timedOut ? 'timeout' : readingBody ? 'invalid_json' : 'request_failed'}`,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
