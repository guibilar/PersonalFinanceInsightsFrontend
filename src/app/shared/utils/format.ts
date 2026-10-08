/** Amounts and days as the app shows them everywhere: Canadian dollars, and calendar days in English. */

const currencyFormatter = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const compactFormatter = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** "$1,234.56", "-$5.00". */
export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

/** "$5K", "$1.2K": for axis ticks, which carry the values that aren't labelled. */
export function formatCompactCurrency(value: number): string {
  return compactFormatter.format(value);
}

/**
 * A calendar day from the API ("2026-06-30T00:00:00Z", or just "2026-06-30") as "Jun 30, 2026", or "Jun 30" with
 * `year: false`. Read as the day it is: midnight UTC would be the day before west of Greenwich.
 */
export function formatDay(iso: string, options: { year?: boolean } = {}): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(options.year === false ? {} : { year: 'numeric' }),
  });
}
