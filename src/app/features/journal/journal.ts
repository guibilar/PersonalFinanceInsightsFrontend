import { HttpErrorResponse } from '@angular/common/http';
import { formatDay } from '../../shared/utils/format';
import { validationDetail } from '../../shared/utils/problem-detail';

/** The limits of the Journal module (HestiaBackend, `JournalLimits`). */
export const JOURNAL_LIMITS = {
  text: 20_000,
  search: 200,
} as const;

/** A day as `yyyy-MM-dd`, or null when the text is not one. */
export function dayOrNull(value: string | null | undefined): string | null {
  const day = value?.trim() ?? '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const [year, month, date] = match.slice(1).map(Number);
  // A real day of the calendar: 2026-02-30 is not one.
  const utc = new Date(Date.UTC(year, month - 1, date));
  return utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === date
    ? day
    : null;
}

/** "Saturday, October 10" (with the year when it is not the year of `today`). */
export function longDay(day: string, today: string): string {
  const date = new Date(`${day}T00:00:00`);
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** The one-letter weekday of the week strip: "S", "M", "T", … */
export function weekdayLetter(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString('en-US', { weekday: 'narrow' });
}

/** The day of the month: "10". */
export function dayNumber(day: string): number {
  return Number(day.slice(8, 10));
}

/** "12-day streak", "1-day streak", or null for none. */
export function streakText(streak: number): string | null {
  return streak > 0 ? `${streak}-day streak` : null;
}

/** "Oct 10, 2025 · 1 year ago". */
export function onThisDayText(day: string, yearsAgo: number): string {
  return `${formatDay(day)} · ${yearsAgo === 1 ? '1 year ago' : `${yearsAgo} years ago`}`;
}

/** What to say when the API refuses a change. */
export function journalError(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 403) return 'This account can only read the journal.';
    if (error.status === 404) return 'This entry does not exist any more.';
    if (error.status === 409) return 'The entry was just written somewhere else. Load it again.';
  }
  return validationDetail(error, fallback);
}
