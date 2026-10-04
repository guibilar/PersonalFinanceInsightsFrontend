import {
  RecurringCadence,
  RecurringPaymentDto,
} from '../../core/models/outputs/insights-output-dto';

/** "every month", for a line under a recurring payment. */
export const CADENCE_LABELS: Record<RecurringCadence, string> = {
  Weekly: 'every week',
  Biweekly: 'every 2 weeks',
  Monthly: 'every month',
  Quarterly: 'every 3 months',
  Yearly: 'every year',
};

/** How a recurring payment's status reads, and its badge colour. */
export function recurringStatus(
  payment: RecurringPaymentDto,
): { label: string; tone: string } | null {
  switch (payment.status) {
    case 'Late':
      return { label: 'Late or missed', tone: 'warning' };
    case 'Stopped':
      return { label: 'Stopped', tone: 'secondary' };
    default:
      return null;
  }
}

/**
 * How much one amount changed from another, as people say it: "12% more", "5% less", "about the same" (within 1%).
 * Null when there is nothing before to compare with.
 */
export function changeText(now: number, before: number): { text: string; up: boolean } | null {
  if (before <= 0) return null;
  const change = ((now - before) / before) * 100;
  if (Math.abs(change) < 1) return { text: 'about the same', up: false };
  return {
    text: `${Math.abs(change).toFixed(0)}% ${change > 0 ? 'more' : 'less'}`,
    up: change > 0,
  };
}

/** "12% more than August", "about the same as usual". */
export function compared(change: { text: string }, other: string): string {
  return `${change.text} ${change.text === 'about the same' ? 'as' : 'than'} ${other}`;
}

/** A calendar day from the API ("2026-10-20T00:00:00Z") as "Oct 20", read as the date it is, not a local time. */
export function shortDay(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/** The month a review covers after or before ([year, month]), or the year; null past today or before the data. */
export function stepReview(
  year: number,
  month: number | null,
  step: 1 | -1,
  today: Date,
  earliest: string | null,
): { year: number; month: number | null } | null {
  let next: { year: number; month: number | null };
  if (month === null) {
    next = { year: year + step, month: null };
  } else {
    const date = new Date(year, month - 1 + step, 1);
    next = { year: date.getFullYear(), month: date.getMonth() + 1 };
  }
  const nowKey = today.getFullYear() * 12 + today.getMonth();
  const firstKey = earliest ? +earliest.slice(0, 4) * 12 + (+earliest.slice(5, 7) - 1) : null;
  // A year spans its months: it is there while any of them is.
  const startKey = next.year * 12 + (next.month === null ? 0 : next.month - 1);
  const endKey = next.year * 12 + (next.month === null ? 11 : next.month - 1);
  if (startKey > nowKey) return null;
  if (firstKey !== null && endKey < firstKey) return null;
  return next;
}
