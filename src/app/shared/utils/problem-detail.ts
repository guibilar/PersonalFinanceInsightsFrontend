import { HttpErrorResponse } from '@angular/common/http';

/** The API's explanation of a conflict (409, e.g. a duplicate), or the fallback for anything else. */
export function conflictDetail(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse && error.status === 409) {
    const detail = (error.error as { detail?: unknown } | null)?.detail;
    if (typeof detail === 'string' && detail) return detail;
  }
  return fallback;
}

/** The API's reasons for refusing the input (400 validation problem), joined, or the fallback for anything else. */
export function validationDetail(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse && error.status === 400) {
    const errors = (error.error as { errors?: Record<string, unknown> } | null)?.errors;
    const messages = Object.values(errors ?? {})
      .flat()
      .filter((message): message is string => typeof message === 'string' && message !== '');
    if (messages.length > 0) return messages.join(' ');
  }
  return fallback;
}
