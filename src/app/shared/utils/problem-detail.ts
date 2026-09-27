import { HttpErrorResponse } from '@angular/common/http';

/** The API's explanation of a conflict (409, e.g. a duplicate), or the fallback for anything else. */
export function conflictDetail(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse && error.status === 409) {
    const detail = (error.error as { detail?: unknown } | null)?.detail;
    if (typeof detail === 'string' && detail) return detail;
  }
  return fallback;
}
